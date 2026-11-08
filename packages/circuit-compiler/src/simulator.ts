import type { CompiledCircuit } from '@latchwork/shared';

export function packBits(bits: boolean[]): Uint8Array {
  const byteCount = Math.ceil(bits.length / 8);
  const bytes = new Uint8Array(byteCount);
  for (let i = 0; i < bits.length; i++) {
    if (bits[i]) {
      const byteIdx = Math.floor(i / 8);
      const bitIdx = i % 8;
      bytes[byteIdx] |= 1 << bitIdx;
    }
  }
  return bytes;
}

export function unpackBits(bytes: Uint8Array, count: number): boolean[] {
  if (!Number.isInteger(count) || count < 0 || count > bytes.length * 8) {
    throw new Error('Packed bit array is too short for the requested output count');
  }
  const bits: boolean[] = [];
  for (let i = 0; i < count; i++) {
    const byteIdx = Math.floor(i / 8);
    const bitIdx = i % 8;
    const isSet = ((bytes[byteIdx] >> bitIdx) & 1) === 1;
    bits.push(isSet);
  }
  return bits;
}

export function simulateCircuit(
  circuit: CompiledCircuit,
  inputs: boolean[],
): { outputs: boolean[]; wireStates: boolean[] } {
  if (circuit.gates.length !== circuit.numGates || circuit.numOutputs < 1 || circuit.numOutputs > circuit.numGates) {
    throw new Error('Invalid circuit dimensions');
  }
  if (inputs.length !== circuit.numInputs) {
    throw new Error(
      `Input count mismatch: expected ${circuit.numInputs}, received ${inputs.length}`,
    );
  }

  // Total wires: 2 (constants 0 and 1) + numInputs + numGates
  const totalWires = 2 + circuit.numInputs + circuit.numGates;
  const wires = new Array<boolean>(totalWires);

  // Wire 0 is False (0)
  wires[0] = false;
  // Wire 1 is True (1)
  wires[1] = true;

  // Wires 2..(1 + numInputs) are inputs
  for (let i = 0; i < circuit.numInputs; i++) {
    wires[2 + i] = inputs[i];
  }

  // Evaluate each NAND gate
  for (let g = 0; g < circuit.gates.length; g++) {
    const gate = circuit.gates[g];
    const wireIndex = 2 + circuit.numInputs + g;
    if (gate.op !== 0 || ![gate.inA, gate.inB].every((wire) => Number.isInteger(wire) && wire >= 0 && wire < wireIndex)) {
      throw new Error('Invalid NAND gate or forward wire reference');
    }
    const a = wires[gate.inA];
    const b = wires[gate.inB];
    // Opcode 0 = NAND
    wires[wireIndex] = !(a && b);
  }

  // In TapeOut, the output bits correspond to the last `numOutputs` wires
  const outputs: boolean[] = [];
  const firstOutputWire = totalWires - circuit.numOutputs;
  for (let o = 0; o < circuit.numOutputs; o++) {
    outputs.push(wires[firstOutputWire + o]);
  }

  return { outputs, wireStates: wires };
}

export interface TruthTableRow {
  inputs: Record<string, boolean>;
  outputs: Record<string, boolean>;
  authorized: boolean;
}

export function generateTruthTable(circuit: CompiledCircuit): TruthTableRow[] {
  if (!Number.isInteger(circuit.numInputs) || circuit.numInputs < 0 || circuit.numInputs > 16) {
    throw new Error('Exhaustive truth tables support at most 16 inputs');
  }
  const totalCombinations = 1 << circuit.numInputs;
  const rows: TruthTableRow[] = [];

  for (let i = 0; i < totalCombinations; i++) {
    const inputBits: boolean[] = [];
    const inputsRecord: Record<string, boolean> = {};

    for (let b = 0; b < circuit.numInputs; b++) {
      const bitVal = ((i >> b) & 1) === 1;
      inputBits.push(bitVal);
      const name = circuit.inputNames[b] || `in_${b}`;
      inputsRecord[name] = bitVal;
    }

    const { outputs } = simulateCircuit(circuit, inputBits);
    const outputsRecord: Record<string, boolean> = {};
    for (let o = 0; o < circuit.numOutputs; o++) {
      const name = circuit.outputNames[o] || `out_${o}`;
      outputsRecord[name] = outputs[o];
    }

    rows.push({
      inputs: inputsRecord,
      outputs: outputsRecord,
      authorized: outputs[0] === true,
    });
  }

  return rows;
}

