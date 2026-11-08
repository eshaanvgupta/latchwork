import { buildMonitorServer } from './server.js';
import { buildTestServiceServer } from './test-service.js';

const monitorPort = Number(process.env.MONITOR_PORT || 4003);
const testServicePort = Number(process.env.TEST_SERVICE_PORT || 4002);

async function main() {
  const monitorServer = buildMonitorServer();
  const testServiceServer = buildTestServiceServer();

  try {
    if (process.env.NODE_ENV !== 'production') {
      await testServiceServer.listen({ port: testServicePort, host: process.env.HOST || '127.0.0.1' });
      console.log(`[LATCHWORK Test Service] Running on http://127.0.0.1:${testServicePort}`);
    }

    await monitorServer.listen({ port: monitorPort, host: process.env.HOST || '127.0.0.1' });
    console.log(`[LATCHWORK Monitor] Witness Network Server running on http://127.0.0.1:${monitorPort}`);
  } catch (err) {
    console.error('Failed to start monitor/test service:', err);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  main();
}

