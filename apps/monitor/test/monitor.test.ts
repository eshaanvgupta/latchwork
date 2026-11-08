import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildTestServiceServer, chaosState } from '../src/test-service.js';
import { ServiceProber } from '../src/prober.js';
import { WitnessNetwork } from '../src/witness.js';
import { verifyWitnessReportSignature } from '@latchwork/shared';

describe('Monitor & Witness Subsystem', () => {
  const testApp = buildTestServiceServer();
  const witnessNetwork = new WitnessNetwork();
  let testUrl: string;

  beforeAll(async () => {
    vi.stubEnv('ALLOW_LOCAL_UPSTREAMS', 'true');
    testUrl = await testApp.listen({ port: 0, host: '127.0.0.1' });
  });

  afterAll(async () => {
    await testApp.close();
    vi.unstubAllEnvs();
  });

  it('should serve /health and respond to chaos latency injection', async () => {
    const res1 = await testApp.inject({ method: 'GET', url: '/health' });
    expect(res1.statusCode).toBe(200);

    // Inject 50ms latency
    const resChaos = await testApp.inject({
      method: 'POST',
      url: '/chaos/latency',
      payload: { delayMs: 50 },
    });
    expect(resChaos.statusCode).toBe(200);
    expect(chaosState.injectedLatencyMs).toBe(50);

    // Reset chaos
    await testApp.inject({ method: 'POST', url: '/chaos/reset' });
    expect(chaosState.injectedLatencyMs).toBe(0);
  });

  it('should toggle downtime simulation (503 Service Unavailable)', async () => {
    await testApp.inject({
      method: 'POST',
      url: '/chaos/downtime',
      payload: { active: true },
    });

    const resDown = await testApp.inject({ method: 'GET', url: '/health' });
    expect(resDown.statusCode).toBe(503);

    // Reset downtime
    await testApp.inject({ method: 'POST', url: '/chaos/reset' });
    const resUp = await testApp.inject({ method: 'GET', url: '/health' });
    expect(resUp.statusCode).toBe(200);
  });

  it('should compute metrics correctly in ServiceProber', () => {
    const prober = new ServiceProber();
    // Simulate empty
    const summaryEmpty = prober.getSummary();
    expect(summaryEmpty.availabilityPpm).toBe(0);
    expect(summaryEmpty.observationCount).toBe(0);
  });

  it('should generate valid EIP-712 signed witness reports from all 3 identities', async () => {
    const verifyingContract = '0x548d62a47b54659A6a49d6A6A8A367c5E2Cb4476';
    const agreementId = '0x1234567890123456789012345678901234567890123456789012345678901234';

    await expect(witnessNetwork.generateQuorumBatch({ agreementId, epochId: 1, chainId: 196, verifyingContract, baseNonce: 1 })).rejects.toThrow('unmeasured');
    await witnessNetwork.probeAll(`${testUrl}/health`, agreementId, 1);

    const batch = await witnessNetwork.generateQuorumBatch({
      agreementId,
      epochId: 1,
      chainId: 196,
      verifyingContract,
      baseNonce: 1,
      persist: false,
    });

    expect(batch.length).toBe(3);

    // Verify each report's cryptographic signature
    for (let i = 0; i < batch.length; i++) {
      const rep = batch[i];
      expect(rep.signature).toBeDefined();
      expect(rep.observationCount).toBe(1n);
      expect(rep.measurementEnd).toBeGreaterThanOrEqual(rep.measurementStart);

      const verification = await verifyWitnessReportSignature(
        rep,
        rep.signature!,
        verifyingContract
      );

      expect(verification.isValid).toBe(true);
      expect(verification.recoveredAddress.toLowerCase()).toBe(rep.witness.toLowerCase());
    }
  });

  it('does not reuse observations from another agreement or epoch', async () => {
    await expect(witnessNetwork.generateQuorumBatch({
      agreementId: '0x1234567890123456789012345678901234567890123456789012345678901234',
      epochId: 2,
      chainId: 196,
      verifyingContract: '0x548d62a47b54659A6a49d6A6A8A367c5E2Cb4476',
      baseNonce: 10,
    })).rejects.toThrow('unmeasured');
  });
});

