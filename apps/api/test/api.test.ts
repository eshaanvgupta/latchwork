import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApiServer } from '../src/server.js';
import { privateKeyToAccount } from 'viem/accounts';
import type { FastifyInstance } from 'fastify';

describe('Backend Orchestrator API', () => {
  let app: FastifyInstance;
  const userAccount = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');

  beforeAll(async () => {
    app = buildApiServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should respond to /health with status OK', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('OK');
  });

  it('should complete SIWE wallet authentication cycle', async () => {
    // 1. Get Nonce
    const nonceRes = await app.inject({
      method: 'POST',
      url: '/auth/nonce',
      payload: { address: userAccount.address },
    });
    expect(nonceRes.statusCode).toBe(200);
    const { nonce, message } = JSON.parse(nonceRes.body);
    expect(nonce).toBeDefined();

    // 2. Sign message
    const signature = await userAccount.signMessage({ message });

    // 3. Verify signature
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/auth/verify',
      payload: {
        address: userAccount.address,
        signature,
        message,
      },
    });
    expect(verifyRes.statusCode).toBe(200);
    const { token } = JSON.parse(verifyRes.body);
    expect(token).toBeDefined();

    // 4. Authenticated /auth/me request
    const meRes = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(meRes.statusCode).toBe(200);
    const meBody = JSON.parse(meRes.body);
    expect(meBody.authenticated).toBe(true);
    expect(meBody.address.toLowerCase()).toBe(userAccount.address.toLowerCase());

    const replay = await app.inject({ method: 'POST', url: '/auth/verify', payload: { address: userAccount.address, signature, message } });
    expect(replay.statusCode).toBe(401);
  });

  it('rejects signatures over messages other than the server challenge', async () => {
    const nonceRes = await app.inject({ method: 'POST', url: '/auth/nonce', payload: { address: userAccount.address } });
    const { nonce } = nonceRes.json();
    const message = `A different application asks you to sign nonce ${nonce}`;
    const signature = await userAccount.signMessage({ message });
    const res = await app.inject({ method: 'POST', url: '/auth/verify', payload: { address: userAccount.address, message, signature } });
    expect(res.statusCode).toBe(401);
  });

  it('rejects malformed wallet addresses and private agreement reads', async () => {
    const nonceRes = await app.inject({ method: 'POST', url: '/auth/nonce', payload: { address: 'not-an-address' } });
    expect(nonceRes.statusCode).toBe(400);
    const agreementRes = await app.inject({ method: 'GET', url: '/agreements/unknown' });
    expect(agreementRes.statusCode).toBe(401);
  });

  it('should fetch pre-compiled circuit templates and simulate logic', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/circuits/templates',
    });
    expect(res.statusCode).toBe(200);
    const templates = JSON.parse(res.body);
    expect(templates.length).toBeGreaterThanOrEqual(3);

    // Simulate Template 1 (2-of-3 availability)
    const t1 = templates[0].circuit;
    const simRes = await app.inject({
      method: 'POST',
      url: '/circuits/simulate',
      payload: {
        circuit: t1,
        inputs: [true, true, false],
      },
    });
    expect(simRes.statusCode).toBe(200);
    const simBody = JSON.parse(simRes.body);
    expect(simBody.outputs[0]).toBe(true);
  });

  it('should return analytics overview statistics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/analytics/overview',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.overview).toBeDefined();
    expect(body.blockchain.network).toBe('X Layer Mainnet');
    expect(body.blockchain.chainId).toBe(196);
  });

  it('should query services from marketplace', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/services',
    });
    expect(res.statusCode).toBe(200);
    const services = JSON.parse(res.body);
    expect(Array.isArray(services)).toBe(true);
  });
});

