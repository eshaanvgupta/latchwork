import { describe, it, expect } from 'vitest';
import { CHAINS, TAPEOUT_CONFIG, PROTOCOL_CONFIG, hashWitnessReport } from '../src/index.js';
import type { WitnessEpochReport } from '../src/index.js';

describe('Shared Constants and Protocol Cryptography', () => {
  it('should expose valid X Layer Mainnet configuration', () => {
    expect(CHAINS.XLAYER_MAINNET.id).toBe(196);
    expect(CHAINS.XLAYER_MAINNET.currency.symbol).toBe('OKB');
    expect(TAPEOUT_CONFIG.CPU0_ADDRESS.toLowerCase()).toBe('0x839bdd6fa7a66416a609a735e11de5411b98574e');
    expect(TAPEOUT_CONFIG.FACTORY_ADDRESS.toLowerCase()).toBe('0x1f09daefa827f02cbb40967cc91b259763760761');
    expect(TAPEOUT_CONFIG.GATE_BYTE_SIZE).toBe(7);
    expect(TAPEOUT_CONFIG.OPCODE_NAND).toBe(0);
  });

  it('should compute deterministic EIP-712 typed hash for WitnessEpochReport', () => {
    const report: WitnessEpochReport = {
      agreementId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      epochId: 1n,
      chainId: 196n,
      witness: '0x25A71a07cecf1753ee65b00E0a3AAEf7e0F51c0F',
      measurementStart: 1700000000n,
      measurementEnd: 1700000060n,
      observationCount: 120n,
      availabilityPpm: 999000n,
      p95LatencyMs: 45n,
      evidenceHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      reportNonce: 1n,
      deadline: 1800000000n,
    };

    const hash = hashWitnessReport(report, '0x0000000000000000000000000000000000000001');
    expect(hash).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });
});
