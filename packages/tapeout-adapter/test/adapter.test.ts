import { describe, it, expect } from 'vitest';
import { TapeOutClient } from '../src/index.js';
import { CircuitBuilder } from '@latchwork/circuit-compiler';

describe('TapeOutClient On-Chain Integration (X Layer Mainnet)', () => {
  const client = new TapeOutClient();

  it('should query circuitInfo for Circuit 1 (XOR) on X Layer', async () => {
    const info = await client.getCircuitInfo(1);
    expect(info.numInputs).toBe(2);
    expect(info.numOutputs).toBe(1);
    expect(info.numGates).toBe(4);
  });

  it('should verify live on-chain eval for Circuit 1 matches XOR truth table', async () => {
    // 0 XOR 0 = 0
    const out00 = await client.evalOnChain(1, [false, false]);
    expect(out00[0]).toBe(false);

    // 1 XOR 0 = 1
    const out10 = await client.evalOnChain(1, [true, false]);
    expect(out10[0]).toBe(true);

    // 0 XOR 1 = 1
    const out01 = await client.evalOnChain(1, [false, true]);
    expect(out01[0]).toBe(true);

    // 1 XOR 1 = 0
    const out11 = await client.evalOnChain(1, [true, true]);
    expect(out11[0]).toBe(false);
  });

  it('should verify local simulation equivalence against on-chain Circuit 1', async () => {
    const b = new CircuitBuilder();
    const in0 = b.addInput('A');
    const in1 = b.addInput('B');
    const xorOut = b.xor(in0, in1);
    b.setOutputs([{ wire: xorOut, name: 'xor' }]);
    const localCircuit = b.compile('Local XOR', 'Equivalence check against on-chain circuit 1');

    const result = await client.verifyEquivalence(localCircuit, 1);
    expect(result.isEquivalent).toBe(true);
    expect(result.mismatches).toBe(0);
    expect(result.totalChecked).toBe(4);
  });
});

