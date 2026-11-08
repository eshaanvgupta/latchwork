import {
  createPublicClient,
  http,
  type Address,
  type Hex,
  toHex,
  hexToBytes,
} from 'viem';
import { TAPEOUT_CONFIG, CHAINS } from '@latchwork/shared';
import {
  packBits,
  unpackBits,
  generateTruthTable,
} from '@latchwork/circuit-compiler';
import type { CompiledCircuit } from '@latchwork/shared';
import { TAPEOUT_PROCESSOR_ABI } from './abi.js';

export interface CircuitInfo {
  numInputs: number;
  numOutputs: number;
  numState: number;
  numGates: number;
}

export class TapeOutClient {
  private publicClient;
  public readonly processorAddress: Address;

  constructor(
    rpcUrl: string = CHAINS.XLAYER_MAINNET.rpcUrls[1],
    processorAddress: Address = TAPEOUT_CONFIG.CPU0_ADDRESS,
  ) {
    this.processorAddress = processorAddress;
    this.publicClient = createPublicClient({
      transport: http(rpcUrl),
    });
  }

  public async getNextId(): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.processorAddress,
      abi: TAPEOUT_PROCESSOR_ABI,
      functionName: 'nextId',
    });
  }

  public async getCircuitInfo(circuitId: bigint | number): Promise<CircuitInfo> {
    const [inputs, outputs, state, gates] = await this.publicClient.readContract({
      address: this.processorAddress,
      abi: TAPEOUT_PROCESSOR_ABI,
      functionName: 'circuitInfo',
      args: [BigInt(circuitId)],
    });
    return {
      numInputs: Number(inputs),
      numOutputs: Number(outputs),
      numState: Number(state),
      numGates: Number(gates),
    };
  }

  public async getNetlist(circuitId: bigint | number): Promise<Hex> {
    return await this.publicClient.readContract({
      address: this.processorAddress,
      abi: TAPEOUT_PROCESSOR_ABI,
      functionName: 'netlist',
      args: [BigInt(circuitId)],
    });
  }

  public async evalOnChain(
    circuitId: bigint | number,
    inputBits: boolean[],
    expectedOutputsCount: number = 1,
  ): Promise<boolean[]> {
    const packedInputs = packBits(inputBits);
    const inputsHex = toHex(packedInputs);

    const resultHex = await this.publicClient.readContract({
      address: this.processorAddress,
      abi: TAPEOUT_PROCESSOR_ABI,
      functionName: 'eval',
      args: [BigInt(circuitId), inputsHex],
    });

    const resultBytes = hexToBytes(resultHex);
    return unpackBits(resultBytes, expectedOutputsCount);
  }

  /**
   * Verify that local simulation matches on-chain TapeOut evaluation across all possible inputs
   */
  public async verifyEquivalence(
    circuit: CompiledCircuit,
    onChainCircuitId: bigint | number,
  ): Promise<{ isEquivalent: boolean; mismatches: number; totalChecked: number }> {
    const info = await this.getCircuitInfo(onChainCircuitId);
    if (info.numInputs !== circuit.numInputs || info.numOutputs !== circuit.numOutputs || info.numState !== 0) {
      throw new Error('On-chain circuit dimensions or state do not match the stateless local circuit');
    }
    const truthTable = generateTruthTable(circuit);
    let mismatches = 0;

    for (let i = 0; i < truthTable.length; i++) {
      const row = truthTable[i];
      const inputBits: boolean[] = [];
      for (let b = 0; b < circuit.numInputs; b++) {
        const name = circuit.inputNames[b] || `in_${b}`;
        inputBits.push(row.inputs[name]);
      }

      const onChainOutputs = await this.evalOnChain(
        onChainCircuitId,
        inputBits,
        circuit.numOutputs,
      );

      if (onChainOutputs.some((value, index) => value !== row.outputs[circuit.outputNames[index] || `out_${index}`])) {
        mismatches++;
      }
    }

    return {
      isEquivalent: mismatches === 0,
      mismatches,
      totalChecked: truthTable.length,
    };
  }
}

