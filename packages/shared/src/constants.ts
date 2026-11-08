import type { Address } from 'viem';

export const CHAINS = {
  XLAYER_MAINNET: {
    id: 196,
    name: 'X Layer Mainnet',
    rpcUrls: ['https://rpc.xlayer.tech', 'https://xlayerrpc.okx.com'],
    blockExplorer: 'https://www.oklink.com/xlayer',
    currency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  },
  XLAYER_TESTNET: {
    id: 1952,
    name: 'X Layer Testnet',
    rpcUrls: ['https://testrpc.xlayer.tech/terigon'],
    blockExplorer: 'https://www.oklink.com/xlayer-test',
    currency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  },
  LOCAL_ANVIL: {
    id: 31337,
    name: 'Anvil Localhost',
    rpcUrls: ['http://127.0.0.1:8545'],
    currency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  },
} as const;

export const TAPEOUT_CONFIG = {
  FACTORY_ADDRESS: '0x1f09daefa827f02cbb40967cc91b259763760761' as Address,
  CPU0_ADDRESS: '0x839bdd6fa7a66416a609a735e11de5411b98574e' as Address,
  CIRCUIT_BEACON: '0xf70d1ed4f62CF3780157B0b421b7E2F45bD0991C' as Address,
  CIRCUIT_IMPL: '0x977f217887E085D298Cb3819cDAD5A0ee35F29B2' as Address,
  TAPEOUT_FEE_WEI: 1300000000000000n, // 0.0013 ether
  GATE_BYTE_SIZE: 7,
  OPCODE_NAND: 0,
} as const;

export const PROTOCOL_CONFIG = {
  PROTOCOL_FEE_BPS: 50n, // 0.5% (50 / 10000)
  BPS_DENOMINATOR: 10000n,
  DEFAULT_QUORUM: 2, // 2-of-3 witnesses
  DISPUTE_WINDOW_SECONDS: 3600, // 1 hour window
  MIN_EPOCH_SECONDS: 60, // 60s for demo/testing, 3600 for standard
} as const;

export const EIP712_DOMAINS = {
  WITNESS_REPORT: {
    name: 'LatchworkWitnessNetwork',
    version: '1',
  },
  USAGE_RECEIPT: {
    name: 'LatchworkGateway',
    version: '1',
  },
} as const;

export const WITNESS_REPORT_EIP712_TYPES = {
  WitnessEpochReport: [
    { name: 'agreementId', type: 'bytes32' },
    { name: 'epochId', type: 'uint256' },
    { name: 'chainId', type: 'uint256' },
    { name: 'witness', type: 'address' },
    { name: 'measurementStart', type: 'uint256' },
    { name: 'measurementEnd', type: 'uint256' },
    { name: 'observationCount', type: 'uint256' },
    { name: 'availabilityPpm', type: 'uint256' },
    { name: 'p95LatencyMs', type: 'uint256' },
    { name: 'evidenceHash', type: 'bytes32' },
    { name: 'reportNonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

