import { buildApiServer } from './server.js';

const port = Number(process.env.PORT || 4000);
const server = buildApiServer();

async function main() {
  try {
    await server.listen({ port, host: process.env.HOST || '127.0.0.1' });
    console.log(`[LATCHWORK API] Backend orchestrator running on http://127.0.0.1:${port}`);
  } catch (err) {
    console.error('Failed to start API server:', err);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  main();
}

