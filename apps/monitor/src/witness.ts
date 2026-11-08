import { privateKeyToAccount } from 'viem/accounts';
import { type Hex, type Address } from 'viem';
import { ServiceProber, type MetricSummary } from './prober.js';
import {
  getWitnessReportTypedData,
  type WitnessEpochReport,
} from '@latchwork/shared';
import { prisma } from '@latchwork/database';

export interface WitnessIdentity {
  id: string;
  name: string;
  privateKey: Hex;
  address: Address;
  account: ReturnType<typeof privateKeyToAccount>;
  prober: ServiceProber;
}

const DEFAULT_WITNESS_KEYS: Hex[] = [
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  '0x47e179ec340f64711564e58140a83831da9703ca070bed1f0fac626ee0fbdf43',
];

export class WitnessNetwork {
  private readonly scopedProbers = new Map<string, ServiceProber[]>();
  public readonly witnesses: WitnessIdentity[];
  public readonly trustDisclosure =
    'DISCLOSURE: Three signing identities run in one operator-controlled process. They are not independent monitoring operators.';

  constructor(customKeys?: Hex[]) {
    if (!customKeys && process.env.NODE_ENV === 'production' && ['WITNESS_1_PRIVATE_KEY', 'WITNESS_2_PRIVATE_KEY', 'WITNESS_3_PRIVATE_KEY'].some(name => !process.env[name])) {
      throw new Error('Production requires three explicitly configured witness private keys');
    }
    const keys = customKeys || [
      (process.env.WITNESS_1_PRIVATE_KEY as Hex) || DEFAULT_WITNESS_KEYS[0],
      (process.env.WITNESS_2_PRIVATE_KEY as Hex) || DEFAULT_WITNESS_KEYS[1],
      (process.env.WITNESS_3_PRIVATE_KEY as Hex) || DEFAULT_WITNESS_KEYS[2],
    ];

    this.witnesses = keys.map((key, i) => {
      const account = privateKeyToAccount(key);
      return {
        id: `witness-${i + 1}`,
        name: `LATCHWORK Witness Node ${i + 1}`,
        privateKey: key,
        address: account.address,
        account,
        prober: new ServiceProber(),
      };
    });
  }

  public getWitnessAddresses(): Address[] {
    return this.witnesses.map((w) => w.address);
  }

  /**
   * Probes the given endpoint from all 3 independent witness perspectives
   */
  public async probeAll(targetUrl: string, agreementId: string, epochId: number) {
    const scope = `${agreementId}:${epochId}`;
    let probers = this.scopedProbers.get(scope);
    if (!probers) {
      probers = this.witnesses.map(() => new ServiceProber());
      this.scopedProbers.set(scope, probers);
    }
    const results = await Promise.all(
      this.witnesses.map(async (w, index) => {
        const obs = await probers[index].probeEndpoint(targetUrl);
        return { witness: w.address, name: w.name, observation: obs };
      })
    );
    return results;
  }

  /**
   * Generates and cryptographically signs an EIP-712 epoch report for a specific witness
   */
  public async signEpochReport(params: {
    witnessIndex: number;
    agreementId: Hex;
    epochId: bigint | number;
    chainId: bigint | number;
    verifyingContract: Address;
    reportNonce: bigint | number;
    metrics?: MetricSummary;
    persist?: boolean;
  }): Promise<WitnessEpochReport> {
    const witness = this.witnesses[params.witnessIndex];
    if (!witness) {
      throw new Error(`Invalid witness index: ${params.witnessIndex}`);
    }

    const metrics = params.metrics || this.scopedProbers.get(`${params.agreementId}:${params.epochId}`)?.[params.witnessIndex].getSummary();
    if (!metrics || metrics.observationCount === 0) {
      throw new Error('Cannot sign an unmeasured agreement epoch');
    }
    if (BigInt(params.reportNonce) < 0n || BigInt(params.reportNonce) > 2147483647n) throw new Error('Report nonce exceeds local database bounds');
    const now = Math.floor(Date.now() / 1000);

    const report: WitnessEpochReport = {
      agreementId: params.agreementId,
      epochId: BigInt(params.epochId),
      chainId: BigInt(params.chainId),
      witness: witness.address,
      measurementStart: BigInt(metrics.measurementStart),
      measurementEnd: BigInt(metrics.measurementEnd),
      observationCount: BigInt(metrics.observationCount),
      availabilityPpm: BigInt(metrics.availabilityPpm),
      p95LatencyMs: BigInt(metrics.p95LatencyMs),
      evidenceHash: metrics.evidenceHash,
      reportNonce: BigInt(params.reportNonce),
      deadline: BigInt(now + 600), // 10 minute deadline
    };

    const typedData = getWitnessReportTypedData(report, params.verifyingContract);
    const signature = await witness.account.signTypedData(typedData as any);
    report.signature = signature;

    // A report returned by the service must have a durable record.
    if (params.persist !== false) {
      await prisma.witnessReportRecord.upsert({
        where: {
          agreementId_epochId_witnessAddress: {
            agreementId: params.agreementId,
            epochId: Number(params.epochId),
            witnessAddress: witness.address,
          },
        },
        update: {
          chainId: Number(report.chainId),
          measurementStart: new Date(Number(report.measurementStart) * 1000),
          measurementEnd: new Date(Number(report.measurementEnd) * 1000),
          observationCount: Number(report.observationCount),
          availabilityPpm: Number(report.availabilityPpm),
          p95LatencyMs: Number(report.p95LatencyMs),
          evidenceHash: report.evidenceHash,
          reportNonce: Number(report.reportNonce),
          deadline: new Date(Number(report.deadline) * 1000),
          signature,
        },
        create: {
          agreementId: params.agreementId,
          epochId: Number(params.epochId),
          chainId: Number(params.chainId),
          witnessAddress: witness.address,
          measurementStart: new Date(Number(report.measurementStart) * 1000),
          measurementEnd: new Date(Number(report.measurementEnd) * 1000),
          observationCount: Number(report.observationCount),
          availabilityPpm: Number(report.availabilityPpm),
          p95LatencyMs: Number(report.p95LatencyMs),
          evidenceHash: report.evidenceHash,
          reportNonce: Number(report.reportNonce),
          deadline: new Date(Number(report.deadline) * 1000),
          signature,
        },
      });
    }

    return report;
  }

  /**
   * Generates a 3-report quorum batch for on-chain settlement
   */
  public async generateQuorumBatch(params: {
    agreementId: Hex;
    epochId: bigint | number;
    chainId: bigint | number;
    verifyingContract: Address;
    baseNonce: bigint | number;
    persist?: boolean;
  }): Promise<WitnessEpochReport[]> {
    const reports: WitnessEpochReport[] = [];
    for (let i = 0; i < this.witnesses.length; i++) {
      const rep = await this.signEpochReport({
        witnessIndex: i,
        agreementId: params.agreementId,
        epochId: params.epochId,
        chainId: params.chainId,
        verifyingContract: params.verifyingContract,
        reportNonce: BigInt(params.baseNonce) + BigInt(i),
        persist: params.persist,
      });
      reports.push(rep);
    }
    return reports;
  }
}

export const defaultWitnessNetwork = new WitnessNetwork();

