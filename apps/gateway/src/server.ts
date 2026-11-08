import Fastify from 'fastify';
import cors from '@fastify/cors';
import { proxyApiRequest } from './proxy.js';
import { gatewaySignerAccount } from './receipts.js';
import { prisma } from '@latchwork/database';
import { authenticateGatewayKey } from './credentials.js';

export function buildGatewayServer() {
  const fastify = Fastify({
    logger: false,
    bodyLimit: 10 * 1024 * 1024, // 10MB limit
  });

  fastify.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    exposedHeaders: [
      'x-latchwork-request-id',
      'x-latchwork-latency-ms',
      'x-latchwork-receipt-id',
      'x-latchwork-receipt-signature',
    ],
  });

  // Health check
  fastify.get('/health', async () => {
    return {
      status: 'OK',
      service: 'LATCHWORK Live API Gateway',
      gatewaySigner: gatewaySignerAccount.address,
      timestamp: new Date().toISOString(),
    };
  });

  // Query receipts
  fastify.get('/v1/receipts/:receiptId', async (req, reply) => {
    const key = await authenticateGatewayKey(req.headers['x-latchwork-key'] as string | undefined);
    if (!key) return reply.status(401).send({ error: 'Valid gateway key required' });
    const { receiptId } = req.params as { receiptId: string };
    const receipt = await prisma.usageReceiptRecord.findFirst({
      where: {
        agreementId: key.agreementId,
        OR: [{ id: receiptId }, { requestId: receiptId.replace('rcpt_', '') }],
      },
    });

    if (!receipt) {
      return reply.status(404).send({ error: 'Receipt not found' });
    }
    return receipt;
  });

  // Reverse proxy route: /v1/service/:serviceSlug/*
  fastify.all('/v1/service/:serviceSlug/*', async (req, reply) => {
    const { serviceSlug } = req.params as { serviceSlug: string };
    const wildcard = (req.params as any)['*'] || '';
    const targetPath = `/${wildcard}${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;

    const apiKey = (req.headers['x-latchwork-key'] || req.headers.authorization?.replace('Bearer ', '')) as string | undefined;

    const proxyRes = await proxyApiRequest({
      apiKey,
      serviceSlug,
      path: targetPath,
      method: req.method,
      headers: req.headers as Record<string, string | string[] | undefined>,
      body: req.body ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) : undefined,
    });

    for (const [k, v] of Object.entries(proxyRes.headers)) {
      reply.header(k, v);
    }

    return reply.status(proxyRes.statusCode).send(proxyRes.body);
  });

  return fastify;
}

