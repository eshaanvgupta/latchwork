export type Hex = `0x${string}`;
export type Address = `0x${string}`;

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerAddress: Address;
  createdAt: number;
}

export interface ServicePlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  pricePerEpochUsdc: number; // in USDC (e.g. 29.00 or 149.00)
  requestQuota: number; // requests allowed per epoch
  rateLimitRps: number; // max requests per second
  slaUptimePpm: number; // parts per million: 995,000 = 99.5%
  slaLatencyMs: number; // e.g. 250ms
}

export interface Service {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  description: string;
  upstreamUrl: string;
  category: string;
  isVerified: boolean;
  verificationChallenge: string;
  providerAddress: Address;
  plans: ServicePlan[];
  createdAt: number;
  status: 'ACTIVE' | 'PAUSED' | 'RETIRED';
}

export type AgreementStatus =
  | 'PENDING_DEPOSIT'
  | 'ACTIVE'
  | 'SETTLED'
  | 'REFUNDED'
  | 'DISPUTED'
  | 'TERMINATED';

export interface Agreement {
  id: string; // bytes32 hex or uuid
  agreementIndex?: number;
  serviceId: string;
  planId: string;
  customerAddress: Address;
  providerAddress: Address;
  escrowDepositUsdc: number; // e.g. 100 USDC
  fundedAmountUsdc: number;
  spentAmountUsdc: number;
  refundedAmountUsdc: number;
  currentEpoch: number;
  epochDurationSeconds: number; // default 3600 (or 60 for demo)
  circuitPolicyId: string;
  status: AgreementStatus;
  createdAt: number;
  expiresAt: number;
}

export interface GatewayKey {
  id: string;
  agreementId: string;
  keyPrefix: string;
  hashedSecret: string;
  status: 'ACTIVE' | 'REVOKED';
  createdAt: number;
}

export interface UsageReceipt {
  receiptId: string;
  agreementId: string;
  epochId: number;
  requestId: string;
  timestamp: number;
  latencyMs: number;
  statusCode: number;
  requestHash: Hex;
  responseHash: Hex;
  signature: Hex; // Gateway signer signature
}

export interface WitnessEpochReport {
  agreementId: Hex; // bytes32
  epochId: bigint;
  chainId: bigint;
  witness: Address;
  measurementStart: bigint;
  measurementEnd: bigint;
  observationCount: bigint;
  availabilityPpm: bigint; // 1,000,000 = 100%
  p95LatencyMs: bigint;
  evidenceHash: Hex; // bytes32
  reportNonce: bigint;
  deadline: bigint;
  signature?: Hex;
}

export interface Gate {
  op: number; // 0 = NAND
  inA: number; // wire index uint24
  inB: number; // wire index uint24
}

export interface CompiledCircuit {
  circuitId?: number; // on-chain CPU circuitId
  name: string;
  description: string;
  numInputs: number;
  numOutputs: number;
  numGates: number;
  gates: Gate[];
  netlistHex: Hex;
  inputNames: string[];
  outputNames: string[];
}

export type SettlementOutcome =
  | 'PAYOUT_PROVIDER'
  | 'REFUND_CUSTOMER'
  | 'SPLIT_PROPORTIONAL'
  | 'DISPUTED_HOLD';

export interface SettlementRecord {
  id: string;
  agreementId: Hex;
  epochId: number;
  witnessAddresses: Address[];
  circuitOutput: boolean;
  outcome: SettlementOutcome;
  providerPayoutUsdc: number;
  customerRefundUsdc: number;
  protocolFeeUsdc: number;
  txHash?: Hex;
  blockNumber?: number;
  settledAt: number;
}

export interface DisputeRecord {
  id: string;
  agreementId: Hex;
  epochId: number;
  claimantAddress: Address;
  reason: string;
  evidenceUri: string;
  status: 'OPEN' | 'UPHELD' | 'DISMISSED';
  createdAt: number;
  resolvedAt?: number;
}
