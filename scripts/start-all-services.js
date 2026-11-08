// LATCHWORK Unified Microservices Runner
import { buildApiServer } from '../apps/api/dist/server.js';
import { buildGatewayServer } from '../apps/gateway/dist/server.js';
import { buildMonitorServer } from '../apps/monitor/dist/server.js';
import { buildTestServiceServer } from '../apps/monitor/dist/test-service.js';

async function bootstrap() {
  const host = process.env.HOST || '127.0.0.1';
  const api = buildApiServer();
  const gateway = buildGatewayServer();
  const monitor = buildMonitorServer();
  const testService = buildTestServiceServer();

  try {
    await api.listen({ port: Number(process.env.PORT || 4000), host });
    console.log('[LATCHWORK API] Running on http://127.0.0.1:4000');

    await gateway.listen({ port: Number(process.env.GATEWAY_PORT || 4001), host });
    console.log('[LATCHWORK Gateway] Running on http://127.0.0.1:4001');

    await testService.listen({ port: Number(process.env.TEST_SERVICE_PORT || 4002), host });
    console.log('[LATCHWORK Test Service] Running on http://127.0.0.1:4002');

    await monitor.listen({ port: Number(process.env.MONITOR_PORT || 4003), host });
    console.log('[LATCHWORK Monitor & Witness] Running on http://127.0.0.1:4003');

    console.log('[LATCHWORK Services] All 4 backend services live and healthy.');

    const shutdown = async () => {
      await Promise.allSettled([api.close(), gateway.close(), monitor.close(), testService.close()]);
      process.exit(0);
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (err) {
    console.error('Failed to start services:', err);
    process.exit(1);
  }
}

bootstrap();
