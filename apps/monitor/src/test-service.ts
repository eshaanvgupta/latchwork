import Fastify from 'fastify';
import cors from '@fastify/cors';

export interface ChaosConfig {
  injectedLatencyMs: number;
  downtimeActive: boolean;
  errorRate: number; // 0.0 to 1.0
}

export const chaosState: ChaosConfig = {
  injectedLatencyMs: 0,
  downtimeActive: false,
  errorRate: 0.0,
};

export function buildTestServiceServer() {
  const fastify = Fastify({ logger: false });

  fastify.register(cors, { origin: '*' });

  // Middleware to apply chaos injection
  fastify.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/chaos')) {
      return; // Chaos controls should never fail
    }

    if (chaosState.downtimeActive) {
      return reply.status(503).send({
        error: 'Service Unavailable (Simulated Outage via LATCHWORK Chaos Engineering)',
        timestamp: new Date().toISOString(),
      });
    }

    if (chaosState.errorRate > 0 && Math.random() < chaosState.errorRate) {
      return reply.status(500).send({
        error: 'Internal Server Error (Simulated Chaos Failure)',
        timestamp: new Date().toISOString(),
      });
    }

    if (chaosState.injectedLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, chaosState.injectedLatencyMs));
    }
  });

  // Health endpoint
  fastify.get('/health', async () => {
    return {
      status: 'HEALTHY',
      service: 'LATCHWORK Test Service',
      version: '1.0.0',
      uptime: process.uptime(),
      chaos: { ...chaosState },
    };
  });

  // Inference / Computation endpoint
  fastify.post('/compute', async (req) => {
    const body = (req.body as any) || {};
    const input = body.input || 'hello';
    // Simulate deterministic mathematical / neural hash computation
    return {
      result: `computed_vector_${Buffer.from(String(input)).toString('base64')}`,
      latencyMs: chaosState.injectedLatencyMs + 5,
      tokensUsed: 42,
    };
  });

  // Latency test endpoint
  fastify.get('/latency', async () => {
    return {
      serverTime: Date.now(),
      injectedDelay: chaosState.injectedLatencyMs,
    };
  });

  // --- Chaos Controls ---
  fastify.post('/chaos/latency', async (req) => {
    const { delayMs } = req.body as { delayMs: number };
    chaosState.injectedLatencyMs = Math.max(0, delayMs || 0);
    return { success: true, message: `Injected latency set to ${chaosState.injectedLatencyMs}ms`, state: chaosState };
  });

  fastify.post('/chaos/downtime', async (req) => {
    const { active } = req.body as { active: boolean };
    chaosState.downtimeActive = Boolean(active);
    return { success: true, message: `Downtime simulation active: ${chaosState.downtimeActive}`, state: chaosState };
  });

  fastify.post('/chaos/error-rate', async (req) => {
    const { rate } = req.body as { rate: number };
    chaosState.errorRate = Math.min(1.0, Math.max(0.0, rate || 0.0));
    return { success: true, message: `Error rate set to ${chaosState.errorRate}`, state: chaosState };
  });

  fastify.post('/chaos/reset', async () => {
    chaosState.injectedLatencyMs = 0;
    chaosState.downtimeActive = false;
    chaosState.errorRate = 0.0;
    return { success: true, message: 'All chaos parameters reset to 0', state: chaosState };
  });

  fastify.get('/chaos/status', async () => {
    return { state: { ...chaosState } };
  });

  return fastify;
}

