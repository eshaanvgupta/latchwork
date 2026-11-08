import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { authRoutes } from './routes/auth.js';
import { orgRoutes } from './routes/orgs.js';
import { serviceRoutes } from './routes/services.js';
import { agreementRoutes } from './routes/agreements.js';
import { circuitRoutes } from './routes/circuits.js';
import { settlementRoutes } from './routes/settlements.js';
import { disputeRoutes } from './routes/disputes.js';
import { analyticsRoutes } from './routes/analytics.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: any;
  }
}

export function buildApiServer(): FastifyInstance {
  const fastify = Fastify({ logger: false });
  fastify.setReplySerializer(payload => JSON.stringify(payload, (_key, value) => typeof value === 'bigint' ? value.toString() : value));

  fastify.register(cors, { origin: '*' });

  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
    throw new Error('Production requires JWT_SECRET with at least 32 characters');
  }
  const jwtSecret = process.env.JWT_SECRET || 'latchwork-development-secret-key-32-chars!!';
  fastify.register(jwt, { secret: jwtSecret });

  fastify.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized: Invalid or missing token' });
    }
  });

  // Base Health
  fastify.get('/health', async () => {
    return {
      status: 'OK',
      service: 'LATCHWORK Backend Orchestrator API',
      timestamp: new Date().toISOString(),
    };
  });

  // Register domain routes
  fastify.register(authRoutes, { prefix: '/auth' });
  fastify.register(orgRoutes, { prefix: '/orgs' });
  fastify.register(serviceRoutes, { prefix: '/services' });
  fastify.register(agreementRoutes, { prefix: '/agreements' });
  fastify.register(circuitRoutes, { prefix: '/circuits' });
  fastify.register(settlementRoutes, { prefix: '/settlements' });
  fastify.register(disputeRoutes, { prefix: '/disputes' });
  fastify.register(analyticsRoutes, { prefix: '/analytics' });

  return fastify;
}

