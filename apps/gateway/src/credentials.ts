import { createHash, timingSafeEqual } from 'node:crypto';
import { prisma } from '@latchwork/database';

export async function authenticateGatewayKey(apiKey?: string) {
  const match = /^lw_live_([a-f0-9]{8})_([a-f0-9]{48})$/.exec(apiKey || '');
  if (!match) return null;
  const key = await prisma.gatewayKey.findUnique({
    where: { keyPrefix: `lw_live_${match[1]}` },
    include: { agreement: { include: { service: true, plan: true } } },
  });
  if (!key || key.status !== 'ACTIVE' || key.agreement.status !== 'ACTIVE') return null;
  const digest = createHash('sha256').update(match[2]).digest();
  const expected = Buffer.from(key.hashedSecret, 'hex');
  if (expected.length !== digest.length || !timingSafeEqual(expected, digest)) return null;
  return key;
}
