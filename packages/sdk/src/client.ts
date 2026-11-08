import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Account,
  recoverAddress,
  hashMessage,
} from 'viem';
import {
  CHAINS,
  TAPEOUT_CONFIG,
  type Agreement,
  type WitnessEpochReport,
  type UsageReceipt,
  type CompiledCircuit,
} from '@latchwork/shared';
import {
  AgreementFactoryABI,
  SettlementVaultABI,
  SettlementEngineABI,
  CircuitPolicyRegistryABI,
  WitnessRegistryABI,
} from '@latchwork/contracts';
import { TapeOutClient } from '@latchwork/tapeout-adapter';
import { simulateCircuit, generateTruthTable } from '@latchwork/circuit-compiler';

export interface LatchworkConfig {
  rpcUrl?: string;
  factoryAddress?: Address;
  vaultAddress?: Address;
  engineAddress?: Address;
  policyRegistryAddress?: Address;
  witnessRegistryAddress?: Address;
  tapeoutProcessorAddress?: Address;
  account?: Account;
}

export class LatchworkClient {
  public readonly publicClient: PublicClient;
  public readonly walletClient?: WalletClient;
  public readonly tapeoutClient: TapeOutClient;

  public readonly factoryAddress: Address;
  public readonly vaultAddress: Address;
  public readonly engineAddress: Address;
  public readonly policyRegistryAddress: Address;
  public readonly witnessRegistryAddress: Address;

  constructor(config: LatchworkConfig = {}) {
    const rpcUrl = config.rpcUrl || CHAINS.XLAYER_MAINNET.rpcUrls[1];
    this.publicClient = createPublicClient({
      transport: http(rpcUrl),
    });

    if (config.account) {
      this.walletClient = createWalletClient({
        account: config.account,
        transport: http(rpcUrl),
      });
    }

    this.factoryAddress = config.factoryAddress || ('0x0000000000000000000000000000000000000000' as Address);
    this.vaultAddress = config.vaultAddress || ('0x0000000000000000000000000000000000000000' as Address);
    this.engineAddress = config.engineAddress || ('0x0000000000000000000000000000000000000000' as Address);
    this.policyRegistryAddress = config.policyRegistryAddress || ('0x0000000000000000000000000000000000000000' as Address);
    this.witnessRegistryAddress = config.witnessRegistryAddress || ('0x0000000000000000000000000000000000000000' as Address);

    this.tapeoutClient = new TapeOutClient(rpcUrl, config.tapeoutProcessorAddress || TAPEOUT_CONFIG.CPU0_ADDRESS);
  }

  // --- Agreement Operations ---
  public async getAgreement(agreementId: Hex): Promise<any> {
    return await this.publicClient.readContract({
      address: this.factoryAddress,
      abi: AgreementFactoryABI,
      functionName: 'getAgreement',
      args: [agreementId],
    });
  }

  public async getCustomerAgreements(customer: Address): Promise<readonly Hex[]> {
    return await this.publicClient.readContract({
      address: this.factoryAddress,
      abi: AgreementFactoryABI,
      functionName: 'getCustomerAgreements',
      args: [customer],
    });
  }

  public async getProviderAgreements(provider: Address): Promise<readonly Hex[]> {
    return await this.publicClient.readContract({
      address: this.factoryAddress,
      abi: AgreementFactoryABI,
      functionName: 'getProviderAgreements',
      args: [provider],
    });
  }

  // --- Vault & Escrow Operations ---
  public async getEscrowBalance(agreementId: Hex): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.vaultAddress,
      abi: SettlementVaultABI,
      functionName: 'agreementEscrow',
      args: [agreementId],
    });
  }

  public async getClaimableBalance(token: Address, user: Address): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.vaultAddress,
      abi: SettlementVaultABI,
      functionName: 'claimableBalances',
      args: [token, user],
    });
  }

  // --- Policy & TapeOut Circuit Operations ---
  public async getPolicy(policyId: Hex): Promise<any> {
    return await this.publicClient.readContract({
      address: this.policyRegistryAddress,
      abi: CircuitPolicyRegistryABI,
      functionName: 'getPolicy',
      args: [policyId],
    });
  }

  public simulatePolicyLocally(circuit: CompiledCircuit, inputs: boolean[]) {
    return simulateCircuit(circuit, inputs);
  }

  public generatePolicyTruthTable(circuit: CompiledCircuit) {
    return generateTruthTable(circuit);
  }

  public async evaluateTapeOutOnChain(circuitId: bigint | number, inputBits: boolean[]): Promise<boolean[]> {
    return await this.tapeoutClient.evalOnChain(circuitId, inputBits);
  }

  // --- Settlement Inspection ---
  public async isEpochSettled(agreementId: Hex, epochId: bigint | number): Promise<boolean> {
    return await this.publicClient.readContract({
      address: this.engineAddress,
      abi: SettlementEngineABI,
      functionName: 'isEpochSettled',
      args: [agreementId, BigInt(epochId)],
    });
  }

  // --- Gateway Usage Receipt Verification ---
  public async verifyUsageReceipt(receipt: UsageReceipt, gatewaySignerAddress: Address): Promise<boolean> {
    const payload = JSON.stringify({
      receiptId: receipt.receiptId,
      agreementId: receipt.agreementId,
      epochId: receipt.epochId,
      requestId: receipt.requestId,
      timestamp: receipt.timestamp,
      latencyMs: receipt.latencyMs,
      statusCode: receipt.statusCode,
      requestHash: receipt.requestHash,
      responseHash: receipt.responseHash,
    });

    const msgHash = hashMessage(payload);
    const recovered = await recoverAddress({
      hash: msgHash,
      signature: receipt.signature,
    });

    return recovered.toLowerCase() === gatewaySignerAddress.toLowerCase();
  }
}
