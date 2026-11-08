import {
  hashTypedData,
  recoverAddress,
  type Address,
  type Hex,
} from 'viem';
import { EIP712_DOMAINS, WITNESS_REPORT_EIP712_TYPES } from './constants.js';
import type { WitnessEpochReport } from './types.js';

export function getWitnessReportTypedData(report: WitnessEpochReport, verifyingContract: Address) {
  return {
    domain: {
      name: EIP712_DOMAINS.WITNESS_REPORT.name,
      version: EIP712_DOMAINS.WITNESS_REPORT.version,
      chainId: Number(report.chainId),
      verifyingContract,
    },
    types: WITNESS_REPORT_EIP712_TYPES,
    primaryType: 'WitnessEpochReport' as const,
    message: {
      agreementId: report.agreementId,
      epochId: report.epochId,
      chainId: report.chainId,
      witness: report.witness,
      measurementStart: report.measurementStart,
      measurementEnd: report.measurementEnd,
      observationCount: report.observationCount,
      availabilityPpm: report.availabilityPpm,
      p95LatencyMs: report.p95LatencyMs,
      evidenceHash: report.evidenceHash,
      reportNonce: report.reportNonce,
      deadline: report.deadline,
    },
  };
}

export function hashWitnessReport(report: WitnessEpochReport, verifyingContract: Address): Hex {
  const typedData = getWitnessReportTypedData(report, verifyingContract);
  return hashTypedData(typedData);
}

export async function verifyWitnessReportSignature(
  report: WitnessEpochReport,
  signature: Hex,
  verifyingContract: Address,
): Promise<{ isValid: boolean; recoveredAddress: Address }> {
  const typedData = getWitnessReportTypedData(report, verifyingContract);
  const recovered = await recoverAddress({
    hash: hashTypedData(typedData),
    signature,
  });
  return {
    isValid: recovered.toLowerCase() === report.witness.toLowerCase(),
    recoveredAddress: recovered,
  };
}

