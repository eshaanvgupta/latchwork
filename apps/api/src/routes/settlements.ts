import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@latchwork/database';
import { SettlementEngineABI } from '@latchwork/contracts';
import { encodeFunctionData, type Hex, type Address } from 'viem';
import type { WitnessEpochReport } from '@latchwork/shared';
import { request as undiciRequest } from 'undici';

export const settlementRoutes: FastifyPluginAsync = async (fastify) => {
  // List settlements
  fastify.get('/', async () => {
    return await prisma.settlementRecord.findMany({
      include: {
        agreement: {
          include: { service: true, plan: true },
        },
      },
      orderBy: { settledAt: 'desc' },
      take: 50,
    });
  });

  // Orchestrate epoch settlement
  fastify.post('/orchestrate', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { agreementId, epochId, chainId, verifyingContract, engineAddress } = req.body as {
      agreementId: Hex;
      epochId: number;
      chainId: number;
      verifyingContract: Address;
      engineAddress: Address;
    };

    if (!agreementId || !epochId) {
      return reply.status(400).send({ error: 'AgreementId and epochId required' });
    }
    const agreement = await prisma.agreement.findUnique({ where: { id: agreementId } });
    if (!agreement || ![agreement.customerAddress, agreement.providerAddress].includes((req as any).user.address.toLowerCase())) {
      return reply.status(403).send({ error: 'Only agreement participants may request settlement calldata' });
    }

    // 1. Gather 2-of-3 quorum signed reports from witness network via monitor endpoint
    const monitorPort = process.env.MONITOR_PORT || 4003;
    let reports: WitnessEpochReport[] = [];

    try {
      const res = await undiciRequest(`${process.env.MONITOR_URL || `http://127.0.0.1:${monitorPort}`}/reports/quorum-batch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(process.env.MONITOR_API_TOKEN ? { authorization: `Bearer ${process.env.MONITOR_API_TOKEN}` } : {}) },
        headersTimeout: 5000,
        bodyTimeout: 5000,
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          agreementId,
          epochId,
          chainId: chainId || 196,
          verifyingContract,
          baseNonce: Math.floor(Date.now() / 1000),
        }),
      });
      const data = (await res.body.json()) as any;
      if (data && data.reports) {
        reports = data.reports;
      }
    } catch (err) {
      // Fallback empty reports if monitor not running
      console.warn('Could not connect to monitor server:', err);
    }

    if (reports.length !== 3) return reply.status(503).send({ error: 'Three measured witness reports are required; no settlement transaction was prepared' });

    // 2. Format on-chain calldata for SettlementEngine
    const calldata = reports.length > 0 ? encodeFunctionData({
      abi: SettlementEngineABI,
      functionName: 'settleEpoch',
      args: [
        agreementId,
        BigInt(epochId),
        reports.map((r: WitnessEpochReport) => ({
          agreementId: r.agreementId,
          epochId: BigInt(r.epochId),
          chainId: BigInt(r.chainId),
          witness: r.witness,
          measurementStart: BigInt(r.measurementStart),
          measurementEnd: BigInt(r.measurementEnd),
          observationCount: BigInt(r.observationCount),
          availabilityPpm: BigInt(r.availabilityPpm),
          p95LatencyMs: BigInt(r.p95LatencyMs),
          evidenceHash: r.evidenceHash,
          reportNonce: BigInt(r.reportNonce),
          deadline: BigInt(r.deadline),
          signature: r.signature as Hex,
        })),
      ],
    }) : '0x';

    return {
      success: true,
      broadcast: false,
      simulated: false,
      note: 'Unsigned calldata only. Reports contain observed sample intervals; a complete contract epoch window and successful transaction simulation are required before broadcasting.',
      agreementId,
      epochId,
      witnessReports: reports,
      to: engineAddress,
      data: calldata,
      value: '0',
    };
  });
};
