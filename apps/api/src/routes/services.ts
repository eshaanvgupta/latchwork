import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@latchwork/database';
import crypto from 'crypto';
import { request as undiciRequest } from 'undici';
import { isSafeUpstreamUrl, upstreamDispatcher } from '../upstream.js';

export const serviceRoutes: FastifyPluginAsync = async (fastify) => {
  // Public Marketplace listing
  fastify.get('/', async (req) => {
    const { category, search } = req.query as { category?: string; search?: string };
    const where: any = { status: 'ACTIVE' };
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    return await prisma.service.findMany({
      where,
      include: {
        organization: true,
        plans: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  // Service details
  fastify.get('/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const service = await prisma.service.findUnique({
      where: { slug },
      include: {
        organization: true,
        plans: true,
      },
    });

    if (!service) {
      return reply.status(404).send({ error: 'Service not found' });
    }
    return service;
  });

  // Create Service
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user;
    const body = req.body as {
      orgId: string;
      name: string;
      slug: string;
      description: string;
      upstreamUrl: string;
      category: string;
    };

    const org = await prisma.organization.findFirst({
      where: { id: body.orgId, ownerAddress: user.address.toLowerCase() },
    });

    if (!org) {
      return reply.status(403).send({ error: 'Unauthorized: not organization owner' });
    }

    const verificationChallenge = `latchwork-verify-${crypto.randomBytes(12).toString('hex')}`;

    const allowed = isSafeUpstreamUrl(body.upstreamUrl, process.env.ALLOW_LOCAL_UPSTREAMS === 'true' && process.env.NODE_ENV !== 'production');
    if (!allowed.safe) return reply.status(400).send({ error: allowed.reason });

    const service = await prisma.service.create({
      data: {
        orgId: org.id,
        name: body.name,
        slug: body.slug,
        description: body.description,
        upstreamUrl: body.upstreamUrl,
        category: body.category || 'General API',
        verificationChallenge,
        providerAddress: user.address.toLowerCase(),
        isVerified: false,
        status: 'ACTIVE',
      },
    });

    return service;
  });

  // Verify API ownership
  fastify.post('/:id/verify', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const service = await prisma.service.findUnique({ where: { id } });

    if (!service) {
      return reply.status(404).send({ error: 'Service not found' });
    }
    if (service.providerAddress !== (req as any).user.address.toLowerCase()) {
      return reply.status(403).send({ error: 'Only the service owner can verify ownership' });
    }

    // Probes the upstream endpoint for challenge verification
    let verified = false;
    let dispatcher: Awaited<ReturnType<typeof upstreamDispatcher>> | undefined;
    try {
      const challengeUrl = new URL('/.well-known/latchwork-challenge', service.upstreamUrl);
      dispatcher = await upstreamDispatcher(challengeUrl, process.env.ALLOW_LOCAL_UPSTREAMS === 'true' && process.env.NODE_ENV !== 'production');
      const res = await undiciRequest(challengeUrl, { dispatcher, headersTimeout: 5000, bodyTimeout: 5000, signal: AbortSignal.timeout(10000) });
      const body = await res.body.text();
      if (res.statusCode === 200 && body.trim() === service.verificationChallenge) {
        verified = true;
      }
    } catch {
      verified = false;
    } finally {
      await dispatcher?.close();
    }

    if (verified) {
      const updated = await prisma.service.update({
        where: { id },
        data: { isVerified: true },
      });
      return { success: true, verified: true, service: updated };
    }

    return reply.status(400).send({
      success: false,
      error: 'Challenge verification failed. Host /.well-known/latchwork-challenge containing challenge token.',
      challenge: service.verificationChallenge,
    });
  });

  // Add Service Plan
  fastify.post('/:id/plans', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const service = await prisma.service.findUnique({ where: { id } });
    if (!service || service.providerAddress !== (req as any).user.address.toLowerCase()) {
      return reply.status(403).send({ error: 'Only the service owner can create plans' });
    }
    const body = req.body as {
      name: string;
      slug: string;
      description: string;
      pricePerEpochUsdc: number;
      requestQuota: number;
      rateLimitRps: number;
      slaUptimePpm?: number;
      slaLatencyMs?: number;
    };

    if (!Number.isFinite(body.pricePerEpochUsdc) || body.pricePerEpochUsdc < 0 || !Number.isSafeInteger(body.requestQuota) || body.requestQuota < 1 || !Number.isSafeInteger(body.rateLimitRps) || body.rateLimitRps < 1) {
      return reply.status(400).send({ error: 'Invalid price, request quota, or rate limit' });
    }

    const plan = await prisma.servicePlan.create({
      data: {
        serviceId: id,
        name: body.name,
        slug: body.slug,
        description: body.description,
        pricePerEpochUsdc: body.pricePerEpochUsdc,
        requestQuota: body.requestQuota,
        rateLimitRps: body.rateLimitRps,
        slaUptimePpm: body.slaUptimePpm || 995000,
        slaLatencyMs: body.slaLatencyMs || 250,
      },
    });

    return plan;
  });
};

