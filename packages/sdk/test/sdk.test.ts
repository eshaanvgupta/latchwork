import { describe, it, expect } from 'vitest';
import { LatchworkClient } from '../src/index.js';
import { buildAvailabilityTemplate } from '@latchwork/circuit-compiler';
import { privateKeyToAccount } from 'viem/accounts';
import { hashMessage } from 'viem';
import type { UsageReceipt } from '@latchwork/shared';

describe('Latchwork SDK', () => {
  const client = new LatchworkClient();

  it('should simulate policy circuit via SDK', () => {
    const circuit = buildAvailabilityTemplate();
    const result = client.simulatePolicyLocally(circuit, [true, true, false]);
    expect(result.outputs[0]).toBe(true);
  });

  it('should evaluate circuit 1 on X Layer via SDK TapeOut integration', async () => {
    // 0 XOR 1 = 1
    const res = await client.evaluateTapeOutOnChain(1, [false, true]);
    expect(res[0]).toBe(true);
  });

  it('should cryptographically verify gateway usage receipts', async () => {
    const signerAccount = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');

    const receiptData = {
      receiptId: 'rcpt_123',
      agreementId: '0x1234',
      epochId: 1,
      requestId: 'req_abc',
      timestamp: 1700000000,
      latencyMs: 42,
      statusCode: 200,
      requestHash: '0x1111' as `0x${string}`,
      responseHash: '0x2222' as `0x${string}`,
    };

    const payload = JSON.stringify(receiptData);
    const signature = await signerAccount.signMessage({ message: payload });

    const receipt: UsageReceipt = {
      ...receiptData,
      signature,
    };

    const isValid = await client.verifyUsageReceipt(receipt, signerAccount.address);
    expect(isValid).toBe(true);

    const isInvalid = await client.verifyUsageReceipt(receipt, '0x0000000000000000000000000000000000000001');
    expect(isInvalid).toBe(false);
  });
});

