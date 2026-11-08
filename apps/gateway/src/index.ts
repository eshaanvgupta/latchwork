import { buildGatewayServer } from './server.js';

const port = Number(process.env.GATEWAY_PORT || 4001);
const server = buildGatewayServer();

async function main() {
  try {
    await server.listen({ port, host: process.env.HOST || '127.0.0.1' });
    console.log(`[LATCHWORK Gateway] Live API Gateway running on http://127.0.0.1:${port}`);
  } catch (err) {
    console.error('Failed to start gateway server:', err);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  main();
}

