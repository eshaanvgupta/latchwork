import { describe, it, expect } from 'vitest';
import {
  CircuitBuilder,
  simulateCircuit,
  packBits,
  unpackBits,
  generateTruthTable,
  buildAvailabilityTemplate,
  buildAvailabilityAndLatencyTemplate,
  buildEnterpriseSlaTemplate,
} from '../src/index.js';

describe('CircuitCompiler & Simulator', () => {
  it('should compile and simulate a 4-NAND XOR gate correctly', () => {
    const b = new CircuitBuilder();
    const in0 = b.addInput('A');
    const in1 = b.addInput('B');
    const xorOut = b.xor(in0, in1);
    b.setOutputs([{ wire: xorOut, name: 'xor' }]);
    const circuit = b.compile('XOR Gate', 'Classical 4-NAND XOR gate');

    expect(circuit.numInputs).toBe(2);
    expect(circuit.numOutputs).toBe(1);
    expect(circuit.numGates).toBe(4);
    expect(circuit.netlistHex.length).toBe(2 + 4 * 7 * 2); // '0x' + 4 gates * 7 bytes * 2 hex chars

    // Check truth table
    expect(simulateCircuit(circuit, [false, false]).outputs[0]).toBe(false);
    expect(simulateCircuit(circuit, [true, false]).outputs[0]).toBe(true);
    expect(simulateCircuit(circuit, [false, true]).outputs[0]).toBe(true);
    expect(simulateCircuit(circuit, [true, true]).outputs[0]).toBe(false);
  });

  it('should correctly evaluate Template 1: Availability Quorum (2-of-3)', () => {
    const circuit = buildAvailabilityTemplate();
    expect(circuit.numInputs).toBe(3);
    expect(circuit.numOutputs).toBe(1);

    const tt = generateTruthTable(circuit);
    expect(tt.length).toBe(8);

    // 0 or 1 true => false
    expect(simulateCircuit(circuit, [false, false, false]).outputs[0]).toBe(false);
    expect(simulateCircuit(circuit, [true, false, false]).outputs[0]).toBe(false);
    expect(simulateCircuit(circuit, [false, true, false]).outputs[0]).toBe(false);
    expect(simulateCircuit(circuit, [false, false, true]).outputs[0]).toBe(false);

    // 2 or 3 true => true
    expect(simulateCircuit(circuit, [true, true, false]).outputs[0]).toBe(true);
    expect(simulateCircuit(circuit, [true, false, true]).outputs[0]).toBe(true);
    expect(simulateCircuit(circuit, [false, true, true]).outputs[0]).toBe(true);
    expect(simulateCircuit(circuit, [true, true, true]).outputs[0]).toBe(true);
  });

  it('should correctly evaluate Template 3: Enterprise SLA + Dispute Check', () => {
    const circuit = buildEnterpriseSlaTemplate();
    expect(circuit.numInputs).toBe(5);

    // [w1_ok, w2_ok, w3_ok, agreement_auth, dispute_active]
    // 2 of 3 witnesses ok, agreement authorized, dispute NOT active => AUTHORIZED
    expect(simulateCircuit(circuit, [true, true, false, true, false]).outputs[0]).toBe(true);

    // If dispute active => REJECTED
    expect(simulateCircuit(circuit, [true, true, false, true, true]).outputs[0]).toBe(false);

    // If agreement not authorized => REJECTED
    expect(simulateCircuit(circuit, [true, true, false, false, false]).outputs[0]).toBe(false);

    // If quorum not met => REJECTED
    expect(simulateCircuit(circuit, [true, false, false, true, false]).outputs[0]).toBe(false);
  });

  it('should pack and unpack bits symmetrically', () => {
    const original = [true, false, true, true, false, false, false, true, true];
    const packed = packBits(original);
    const unpacked = unpackBits(packed, original.length);
    expect(unpacked).toEqual(original);
  });

  it('routes selected earlier wires into the TapeOut output suffix in order', () => {
    const b = new CircuitBuilder();
    const a = b.addInput('A');
    const c = b.addInput('B');
    b.xor(a, c);
    b.setOutputs([{ wire: a, name: 'originalA' }, { wire: c, name: 'originalB' }]);
    const circuit = b.compile('Pass through', 'Route earlier input wires');
    expect(simulateCircuit(circuit, [true, false]).outputs).toEqual([true, false]);
    expect(simulateCircuit(circuit, [false, true]).outputs).toEqual([false, true]);
    expect(b.compile('Pass through', '').netlistHex).toBe(circuit.netlistHex);
  });

  it('exhaustively checks the combined availability and latency template', () => {
    for (const row of generateTruthTable(buildAvailabilityAndLatencyTemplate())) {
      const passing = [1, 2, 3].filter((i) => row.inputs[`w${i}_avail_ok`] && row.inputs[`w${i}_lat_ok`]).length;
      expect(row.authorized).toBe(passing >= 2);
    }
  });

  it('rejects malformed forward references and late input allocation', () => {
    const b = new CircuitBuilder();
    const a = b.addInput('A');
    expect(() => b.nand(a, 9)).toThrow();
    b.not(a);
    expect(() => b.addInput('B')).toThrow();
    expect(() => unpackBits(new Uint8Array(0), 1)).toThrow();
  });

  it('routes a circuit consisting only of an input into executable output gates', () => {
    const b = new CircuitBuilder();
    b.setOutputs([{ wire: b.addInput('A'), name: 'A' }]);
    const circuit = b.compile('Identity', '');
    expect(circuit.numGates).toBe(2);
    expect(simulateCircuit(circuit, [false]).outputs).toEqual([false]);
    expect(simulateCircuit(circuit, [true]).outputs).toEqual([true]);
  });
});

