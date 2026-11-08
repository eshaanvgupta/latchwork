import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { prisma } from '@latchwork/database';
import { buildGatewayServer } from '../src/server.js';
import { isSafeUpstreamUrl } from '../src/ssrf.js';

describe('Gateway authenticated forwarding', () => {
  const upstream = Fastify();
  const gateway = buildGatewayServer();
  const suffix = randomUUID();
  const agreementId = `0x${randomBytes(32).toString('hex')}`;
  const slug = `gateway-test-${suffix}`;
  const secret = randomBytes(24).toString('hex');
  const keyPrefix = `lw_live_${secret.slice(0, 8)}`;
  const apiKey = `${keyPrefix}_${secret}`;
  let organizationId: string;
  let serviceId: string;
  let planId: string;
  let upstreamRequests = 0;

  beforeAll(async () => {
    vi.stubEnv('ALLOW_LOCAL_UPSTREAMS', 'true');
    upstream.get('/health', async () => { upstreamRequests++; return { actualUpstream: true }; });
    const upstreamUrl = await upstream.listen({ port: 0, host: '127.0.0.1' });
    const org = await prisma.organization.create({ data: { name: slug, slug, ownerAddress: '0x1111111111111111111111111111111111111111' } });
    organizationId = org.id;
    const service = await prisma.service.create({ data: { orgId: org.id, name: slug, slug, description: 'Integration fixture', upstreamUrl, category: 'Test', verificationChallenge: suffix, providerAddress: org.ownerAddress } });
    serviceId = service.id;
    const plan = await prisma.servicePlan.create({ data: { serviceId, name: 'Test', slug: 'test', description: 'Test', pricePerEpochUsdc: 0, requestQuota: 1, rateLimitRps: 10 } });
    planId = plan.id;
    await prisma.agreement.create({ data: { id: agreementId, serviceId, planId, customerAddress: org.ownerAddress, providerAddress: org.ownerAddress, totalFundedUsdc: 0, circuitPolicyId: 'local-test' } });
    await prisma.gatewayKey.create({ data: { agreementId, keyPrefix, hashedSecret: createHash('sha256').update(secret).digest('hex') } });
    await gateway.ready();
  });

  afterAll(async () => {
    await gateway.close();
    await upstream.close();
    await prisma.usageReceiptRecord.deleteMany({ where: { agreementId } });
    await prisma.gatewayKey.deleteMany({ where: { agreementId } });
    await prisma.agreement.deleteMany({ where: { id: agreementId } });
    if (planId) await prisma.servicePlan.deleteMany({ where: { id: planId } });
    if (serviceId) await prisma.service.deleteMany({ where: { id: serviceId } });
    if (organizationId) await prisma.organization.deleteMany({ where: { id: organizationId } });
    vi.unstubAllEnvs();
  });

  it('rejects absent, invalid and cross-service credentials before forwarding', async () => {
    expect((await gateway.inject({ method: 'GET', url: `/v1/service/${slug}/health` })).statusCode).toBe(401);
    expect((await gateway.inject({ method: 'GET', url: `/v1/service/${slug}/health`, headers: { 'x-latchwork-key': `${keyPrefix}_${'0'.repeat(48)}` } })).statusCode).toBe(401);
    expect((await gateway.inject({ method: 'GET', url: '/v1/service/another-service/health', headers: { 'x-latchwork-key': apiKey } })).statusCode).toBe(403);
    expect(upstreamRequests).toBe(0);
  });

  it('forwards an actual request and binds durable receipts to the authenticated agreement', async () => {
    const res = await gateway.inject({ method: 'GET', url: `/v1/service/${slug}/health`, headers: { 'x-latchwork-key': apiKey, 'x-latchwork-agreement': `0x${'f'.repeat(64)}`, 'x-latchwork-epoch': '999' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().actualUpstream).toBe(true);
    expect(upstreamRequests).toBe(1);
    const receiptId = String(res.headers['x-latchwork-receipt-id']);
    const unauthorized = await gateway.inject({ method: 'GET', url: `/v1/receipts/${receiptId}` });
    expect(unauthorized.statusCode).toBe(401);
    const receiptRes = await gateway.inject({ method: 'GET', url: `/v1/receipts/${receiptId}`, headers: { 'x-latchwork-key': apiKey } });
    expect(receiptRes.statusCode).toBe(200);
    expect(receiptRes.json().agreementId).toBe(agreementId);
    expect(receiptRes.json().epochId).toBe(1);
    expect(receiptRes.json().signature).toBe(res.headers['x-latchwork-receipt-signature']);
  });

  it('enforces the agreement plan quota', async () => {
    const res = await gateway.inject({ method: 'GET', url: `/v1/service/${slug}/health`, headers: { 'x-latchwork-key': apiKey } });
    expect(res.statusCode).toBe(429);
    expect(upstreamRequests).toBe(1);
  });

  it.each(['http://127.1/health', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://10.0.0.1/', 'http://169.254.169.254/', 'http://100.64.0.1/', 'http://192.168.1.1/', 'http://user:secret@example.com/'])('blocks private, reserved or credential-bearing target %s', url => {
    expect(isSafeUpstreamUrl(url, false).safe).toBe(false);
  });
});
