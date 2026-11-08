import { describe, it, expect, vi } from 'vitest';
import { TapeOutClient } from '../src/index.js';
import { CircuitBuilder } from '@latchwork/circuit-compiler';

describe('TapeOut equivalence checks', () => {
  it('compares every output rather than accepting a matching first output', async () => {
    const builder = new CircuitBuilder();
    const input = builder.addInput('A');
    builder.setOutputs([{ wire: input, name: 'A' }, { wire: builder.not(input), name: 'notA' }]);
    const circuit = builder.compile('Two outputs', 'A and its complement');
    const client = new TapeOutClient();
    vi.spyOn(client, 'getCircuitInfo').mockResolvedValue({ numInputs: 1, numOutputs: 2, numState: 0, numGates: circuit.numGates });
    vi.spyOn(client, 'evalOnChain').mockResolvedValueOnce([false, false]).mockResolvedValueOnce([true, false]);
    expect(await client.verifyEquivalence(circuit, 1)).toEqual({ isEquivalent: false, mismatches: 1, totalChecked: 2 });
  });

  it('rejects stateful or mismatched on-chain shapes before evaluating', async () => {
    const builder = new CircuitBuilder();
    builder.setOutputs([{ wire: builder.addInput('A'), name: 'A' }]);
    const circuit = builder.compile('Identity', '');
    const client = new TapeOutClient();
    vi.spyOn(client, 'getCircuitInfo').mockResolvedValue({ numInputs: 1, numOutputs: 1, numState: 1, numGates: 2 });
    await expect(client.verifyEquivalence(circuit, 1)).rejects.toThrow('dimensions or state');
  });
});
