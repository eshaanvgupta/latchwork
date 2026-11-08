import Fastify from 'fastify';
import cors from '@fastify/cors';
import { defaultWitnessNetwork } from './witness.js';
import { buildTestServiceServer } from './test-service.js';
import type { Hex, Address } from 'viem';
import { isAddress } from 'viem';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@latchwork/database';

export function buildMonitorServer() {
  const operatorToken = process.env.MONITOR_API_TOKEN;
  if (process.env.NODE_ENV === 'production' && (!operatorToken || operatorToken.length < 32)) {
    throw new Error('Production monitor requires MONITOR_API_TOKEN with at least 32 characters');
  }
  const fastify = Fastify({ logger: false });
  fastify.setReplySerializer(payload => JSON.stringify(payload, (_key, value) => typeof value === 'bigint' ? value.toString() : value));
  fastify.addHook('onRequest', async (req, reply) => {
    if (req.method === 'GET' || !operatorToken) return;
    const supplied = Buffer.from(req.headers.authorization?.replace(/^Bearer /, '') || '');
    const expected = Buffer.from(operatorToken);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return reply.status(401).send({ error: 'Monitor operator credentials required' });
    }
  });

  fastify.register(cors, { origin: '*' });

  fastify.get('/health', async () => {
    return {
      status: 'OK',
      service: 'LATCHWORK Witness & Monitoring Network',
      witnessCount: defaultWitnessNetwork.witnesses.length,
      witnessAddresses: defaultWitnessNetwork.getWitnessAddresses(),
      trustDisclosure: defaultWitnessNetwork.trustDisclosure,
      timestamp: new Date().toISOString(),
    };
  });

  fastify.post('/probe', async (req, reply) => {
    const { agreementId, epochId, path = '/health' } = (req.body || {}) as { agreementId: string; epochId: number; path?: string };
    if (!agreementId || !Number.isSafeInteger(epochId) || epochId < 1 || typeof path !== 'string') return reply.status(400).send({ error: 'Agreement ID, positive epoch, and optional path required' });
    const agreement = await prisma.agreement.findUnique({ where: { id: agreementId }, include: { service: true } });
    if (!agreement || agreement.status !== 'ACTIVE' || agreement.currentEpoch !== epochId) return reply.status(404).send({ error: 'Active agreement epoch not found' });
    const target = new URL(path, agreement.service.upstreamUrl);
    if (target.origin !== new URL(agreement.service.upstreamUrl).origin) return reply.status(400).send({ error: 'Probe path must stay on the registered service origin' });
    const observations = await defaultWitnessNetwork.probeAll(target.toString(), agreementId, epochId);
    return { success: true, agreementId, epochId, targetUrl: target.toString(), observations };
  });

  fastify.post('/reports/sign', async (req, reply) => {
    const body = req.body as {
      witnessIndex: number;
      agreementId: Hex;
      epochId: number;
      chainId: number;
      verifyingContract: Address;
      reportNonce: number;
    };

    if (!isAddress(body.verifyingContract || '') || !/^0x[a-fA-F0-9]{64}$/.test(body.agreementId || '') || !Number.isSafeInteger(body.epochId) || body.epochId < 1 || !Number.isSafeInteger(body.chainId) || body.chainId < 1) return reply.status(400).send({ error: 'Invalid report domain or agreement epoch' });
    try {
      const { witnessIndex, agreementId, epochId, chainId, verifyingContract, reportNonce } = body;
      const report = await defaultWitnessNetwork.signEpochReport({ witnessIndex, agreementId, epochId, chainId, verifyingContract, reportNonce });
      return { success: true, report };
    } catch (error: any) {
      return reply.status(409).send({ error: error.message });
    }
  });

  fastify.post('/reports/quorum-batch', async (req, reply) => {
    const body = req.body as {
      agreementId: Hex;
      epochId: number;
      chainId: number;
      verifyingContract: Address;
      baseNonce: number;
    };

    if (!isAddress(body.verifyingContract || '') || !/^0x[a-fA-F0-9]{64}$/.test(body.agreementId || '') || !Number.isSafeInteger(body.epochId) || body.epochId < 1 || !Number.isSafeInteger(body.chainId) || body.chainId < 1) return reply.status(400).send({ error: 'Invalid report domain or agreement epoch' });
    try {
      const { agreementId, epochId, chainId, verifyingContract, baseNonce } = body;
      const reports = await defaultWitnessNetwork.generateQuorumBatch({ agreementId, epochId, chainId, verifyingContract, baseNonce });
      return { success: true, count: reports.length, reports };
    } catch (error: any) {
      return reply.status(409).send({ error: error.message });
    }
  });

  return fastify;
}

