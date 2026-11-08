import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@latchwork/database';
import { buildApiServer } from '../src/server.js';

describe('Service ownership authorization', () => {
  const app = buildApiServer();
  const owner = '0x1111111111111111111111111111111111111111';
  const other = '0x2222222222222222222222222222222222222222';
  const suffix = randomUUID();
  let organizationId: string;
  let serviceId: string;
  let token: string;

  beforeAll(async () => {
    await app.ready();
    token = app.jwt.sign({ address: other });
    const org = await prisma.organization.create({ data: { name: suffix, slug: suffix, ownerAddress: owner } });
    organizationId = org.id;
    const service = await prisma.service.create({ data: { orgId: org.id, name: 'Authorization Fixture', slug: suffix, description: 'Test fixture', category: 'Test', upstreamUrl: 'http://169.254.169.254/', verificationChallenge: suffix, providerAddress: owner } });
    serviceId = service.id;
  });

  afterAll(async () => {
    await app.close();
    if (serviceId) await prisma.service.deleteMany({ where: { id: serviceId } });
    if (organizationId) await prisma.organization.deleteMany({ where: { id: organizationId } });
  });

  it('rejects ownership verification and plan mutations by another wallet', async () => {
    const verification = await app.inject({ method: 'POST', url: `/services/${serviceId}/verify`, headers: { authorization: `Bearer ${token}` } });
    expect(verification.statusCode).toBe(403);
    const plan = await app.inject({ method: 'POST', url: `/services/${serviceId}/plans`, headers: { authorization: `Bearer ${token}` }, payload: { name: 'Unauthorized', slug: 'unauthorized', description: '', pricePerEpochUsdc: 0, requestQuota: 10, rateLimitRps: 1 } });
    expect(plan.statusCode).toBe(403);
  });

  it('rejects self-verification when the upstream violates network policy', async () => {
    const ownerToken = app.jwt.sign({ address: owner });
    const verification = await app.inject({ method: 'POST', url: `/services/${serviceId}/verify`, headers: { authorization: `Bearer ${ownerToken}` } });
    expect(verification.statusCode).toBe(400);
    const service = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } });
    expect(service.isVerified).toBe(false);
  });

  it('requires an explicitly configured dispute resolver', async () => {
    const resolution = await app.inject({ method: 'POST', url: '/disputes/unknown/resolve', headers: { authorization: `Bearer ${token}` }, payload: { uphold: true } });
    expect(resolution.statusCode).toBe(403);
  });
});
