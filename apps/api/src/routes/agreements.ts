import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@latchwork/database';
import crypto from 'crypto';

export const agreementRoutes: FastifyPluginAsync = async (fastify) => {
  // List agreements for user
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req) => {
    const user = (req as any).user;
    const addr = user.address.toLowerCase();

    return await prisma.agreement.findMany({
      where: {
        OR: [{ customerAddress: addr }, { providerAddress: addr }],
      },
      include: {
        service: true,
        plan: true,
        settlements: { take: 5, orderBy: { settledAt: 'desc' } },
        gatewayKeys: { where: { status: 'ACTIVE' }, select: { id: true, keyPrefix: true, status: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  // Get Agreement Details
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const agreement = await prisma.agreement.findUnique({
      where: { id },
      include: {
        service: true,
        plan: true,
        gatewayKeys: { select: { id: true, keyPrefix: true, status: true, createdAt: true } },
        settlements: { orderBy: { settledAt: 'desc' } },
        disputes: true,
        witnessReports: { take: 10, orderBy: { createdAt: 'desc' } },
        usageReceipts: { take: 10, orderBy: { timestamp: 'desc' } },
      },
    });

    if (!agreement) {
      return reply.status(404).send({ error: 'Agreement not found' });
    }
    const actor = (req as any).user.address.toLowerCase();
    if (![agreement.customerAddress, agreement.providerAddress].includes(actor)) {
      return reply.status(403).send({ error: 'Only agreement participants may view this record' });
    }
    return agreement;
  });

  // Record Created Agreement
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user;
    const body = req.body as {
      id: string; // bytes32 hex
      serviceId: string;
      planId: string;
      providerAddress: string;
      totalFundedUsdc: number;
      epochDurationSeconds: number;
      circuitPolicyId: string;
    };

    const service = await prisma.service.findUnique({ where: { id: body.serviceId } });
    const plan = await prisma.servicePlan.findUnique({ where: { id: body.planId } });

    if (!service || !plan || plan.serviceId !== service.id) {
      return reply.status(404).send({ error: 'Service or Plan not found' });
    }

    if (process.env.NODE_ENV === 'production') {
      return reply.status(503).send({ error: 'Agreement activation requires a verified on-chain deposit indexer, which is not configured. Use the local sandbox.' });
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(body.id || '') || !Number.isFinite(body.totalFundedUsdc) || body.totalFundedUsdc < 0 || (body.epochDurationSeconds !== undefined && (!Number.isSafeInteger(body.epochDurationSeconds) || body.epochDurationSeconds < 1))) {
      return reply.status(400).send({ error: 'Valid agreement ID, nonnegative amount and positive epoch duration required' });
    }
    const existing = await prisma.agreement.findUnique({ where: { id: body.id } });
    if (existing) return reply.status(409).send({ error: 'Agreement already recorded' });

    const agreement = await prisma.agreement.create({
      data: {
        id: body.id,
        serviceId: service.id,
        planId: plan.id,
        customerAddress: user.address.toLowerCase(),
        providerAddress: service.providerAddress.toLowerCase(),
        totalFundedUsdc: body.totalFundedUsdc,
        epochDurationSeconds: body.epochDurationSeconds || 3600,
        circuitPolicyId: body.circuitPolicyId,
        status: 'ACTIVE',
      },
    });

    // Auto-generate first Gateway API Key
    const secret = crypto.randomBytes(24).toString('hex');
    const keyPrefix = `lw_live_${secret.slice(0, 8)}`;
    const fullApiKey = `${keyPrefix}_${secret}`;
    const hashedSecret = crypto.createHash('sha256').update(secret).digest('hex');

    await prisma.gatewayKey.create({
      data: {
        agreementId: agreement.id,
        keyPrefix,
        hashedSecret,
        status: 'ACTIVE',
      },
    });

    return { agreement, apiKey: fullApiKey, mode: 'LOCAL_SANDBOX', fundingVerified: false };
  });

  // Generate additional gateway key
  fastify.post('/:id/keys', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = (req as any).user;

    const agreement = await prisma.agreement.findUnique({ where: { id } });
    if (!agreement || agreement.customerAddress !== user.address.toLowerCase()) {
      return reply.status(403).send({ error: 'Unauthorized' });
    }

    const secret = crypto.randomBytes(24).toString('hex');
    const keyPrefix = `lw_live_${secret.slice(0, 8)}`;
    const fullApiKey = `${keyPrefix}_${secret}`;
    const hashedSecret = crypto.createHash('sha256').update(secret).digest('hex');

    const key = await prisma.gatewayKey.create({
      data: {
        agreementId: agreement.id,
        keyPrefix,
        hashedSecret,
        status: 'ACTIVE',
      },
    });

    return { key: { id: key.id, keyPrefix: key.keyPrefix, status: key.status, createdAt: key.createdAt }, apiKey: fullApiKey };
  });
};

