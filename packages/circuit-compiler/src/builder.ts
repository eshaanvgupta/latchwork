import type { Gate, CompiledCircuit, Hex } from '@latchwork/shared';

export class CircuitBuilder {
  private inputNames: string[] = [];
  private gates: Gate[] = [];
  private outputWires: number[] = [];
  private outputNames: string[] = [];

  // Wire 0 is Constant FALSE (0)
  // Wire 1 is Constant TRUE (1)
  // Wires 2..(1 + numInputs) are inputs
  // Wires (2 + numInputs).. are gate outputs
  public readonly CONST_FALSE = 0;
  public readonly CONST_TRUE = 1;

  public addInput(name: string): number {
    if (this.gates.length > 0) throw new Error('Declare all inputs before creating gates');
    if (!name || this.inputNames.includes(name)) throw new Error('Input names must be nonempty and unique');
    this.inputNames.push(name);
    // Wire index: 0 is false, 1 is true, so first input is 2
    return 1 + this.inputNames.length;
  }

  public get numInputs(): number {
    return this.inputNames.length;
  }

  private nextGateWire(): number {
    return 2 + this.numInputs + this.gates.length;
  }

  public nand(wireA: number, wireB: number): number {
    const outWire = this.nextGateWire();
    for (const wire of [wireA, wireB]) {
      if (!Number.isInteger(wire) || wire < 0 || wire >= outWire || wire > 0xffffff) {
        throw new Error('Gate inputs must reference existing uint24 wires');
      }
    }
    this.gates.push({ op: 0, inA: wireA, inB: wireB });
    return outWire;
  }

  public not(wire: number): number {
    return this.nand(wire, wire);
  }

  public and(wireA: number, wireB: number): number {
    const n = this.nand(wireA, wireB);
    return this.not(n);
  }

  public or(wireA: number, wireB: number): number {
    const notA = this.not(wireA);
    const notB = this.not(wireB);
    return this.nand(notA, notB);
  }

  public nor(wireA: number, wireB: number): number {
    const orOut = this.or(wireA, wireB);
    return this.not(orOut);
  }

  public xor(wireA: number, wireB: number): number {
    // 4 NAND gates:
    // g0 = NAND(A, B)
    // g1 = NAND(A, g0)
    // g2 = NAND(B, g0)
    // g3 = NAND(g1, g2)
    const g0 = this.nand(wireA, wireB);
    const g1 = this.nand(wireA, g0);
    const g2 = this.nand(wireB, g0);
    return this.nand(g1, g2);
  }

  /**
   * Majority of 3: (A AND B) OR (B AND C) OR (A AND C)
   * Evaluates to true if at least 2 of the 3 inputs are true.
   */
  public majority3(a: number, b: number, c: number): number {
    const ab = this.and(a, b);
    const bc = this.and(b, c);
    const ac = this.and(a, c);
    const ab_or_bc = this.or(ab, bc);
    return this.or(ab_or_bc, ac);
  }

  public setOutputs(wires: { wire: number; name: string }[]) {
    for (const { wire } of wires) {
      if (!Number.isInteger(wire) || wire < 0 || wire >= this.nextGateWire()) {
        throw new Error('Outputs must reference existing wires');
      }
    }
    this.outputWires = wires.map((w) => w.wire);
    this.outputNames = wires.map((w) => w.name);
  }

  /**
   * Encode gates into TapeOut netlist hex:
   * Each gate is 7 bytes: [uint8 op (0), uint24 inA, uint24 inB]
   */
  public encodeNetlist(gates: Gate[] = this.gates): Hex {
    const buffer = new Uint8Array(gates.length * 7);
    for (let i = 0; i < gates.length; i++) {
      const gate = gates[i];
      const offset = i * 7;
      buffer[offset] = gate.op;
      // uint24 inA
      buffer[offset + 1] = (gate.inA >> 16) & 0xff;
      buffer[offset + 2] = (gate.inA >> 8) & 0xff;
      buffer[offset + 3] = gate.inA & 0xff;
      // uint24 inB
      buffer[offset + 4] = (gate.inB >> 16) & 0xff;
      buffer[offset + 5] = (gate.inB >> 8) & 0xff;
      buffer[offset + 6] = gate.inB & 0xff;
    }
    return `0x${Array.from(buffer, (byte) => byte.toString(16).padStart(2, '0')).join('')}` as Hex;
  }

  public compile(name: string, description: string): CompiledCircuit {
    if (this.outputWires.length === 0 && this.gates.length > 0) {
      // By default, the last gate is the primary output
      const lastWire = 2 + this.numInputs + this.gates.length - 1;
      this.outputWires = [lastWire];
      this.outputNames = ['settlement_authorized'];
    }

    if (this.outputWires.length === 0) throw new Error('Circuit requires at least one output');
    const gates = [...this.gates];
    const firstOutputWire = 2 + this.numInputs + gates.length - this.outputWires.length;
    if (this.outputWires.length > gates.length || !this.outputWires.every((wire, index) => wire === firstOutputWire + index)) {
      // TapeOut returns the final N wires, so route explicitly selected outputs
      // into that suffix with two NAND inversions per output.
      const inverses = this.outputWires.map((wire) => {
        const inverseWire = 2 + this.numInputs + gates.length;
        gates.push({ op: 0, inA: wire, inB: wire });
        return inverseWire;
      });
      for (const wire of inverses) gates.push({ op: 0, inA: wire, inB: wire });
    }

    return {
      name,
      description,
      numInputs: this.numInputs,
      numOutputs: this.outputWires.length,
      numGates: gates.length,
      gates,
      netlistHex: this.encodeNetlist(gates),
      inputNames: [...this.inputNames],
      outputNames: [...this.outputNames],
    };
  }
}
