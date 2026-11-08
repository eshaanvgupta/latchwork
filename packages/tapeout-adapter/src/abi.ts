export const TAPEOUT_PROCESSOR_ABI = [
  {
    type: 'function',
    name: 'eval',
    inputs: [
      { name: 'circuitId', type: 'uint256' },
      { name: 'inputs', type: 'bytes' },
    ],
    outputs: [{ name: 'outputs', type: 'bytes' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'step',
    inputs: [
      { name: 'circuitId', type: 'uint256' },
      { name: 'inputs', type: 'bytes' },
      { name: 'state', type: 'bytes' },
    ],
    outputs: [
      { name: 'outputs', type: 'bytes' },
      { name: 'nextState', type: 'bytes' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'tapeout',
    inputs: [
      { name: 'netlist', type: 'bytes' },
      { name: 'numInputs', type: 'uint32' },
      { name: 'numOutputs', type: 'uint32' },
    ],
    outputs: [{ name: 'circuitId', type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'circuitInfo',
    inputs: [{ name: 'circuitId', type: 'uint256' }],
    outputs: [
      { name: 'inputs', type: 'uint32' },
      { name: 'outputs', type: 'uint32' },
      { name: 'state', type: 'uint32' },
      { name: 'gates', type: 'uint32' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'netlist',
    inputs: [{ name: 'circuitId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nextId',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'TAPEOUT_FEE',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

export const TAPEOUT_FACTORY_ABI = [
  {
    type: 'function',
    name: 'cpuCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'cpuAt',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'circuitBeacon',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'deployFee',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

