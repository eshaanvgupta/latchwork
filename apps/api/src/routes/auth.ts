import type { FastifyPluginAsync } from 'fastify';
import { recoverAddress, hashMessage, isAddress, type Address, type Hex } from 'viem';
import { prisma } from '@latchwork/database';
import crypto from 'crypto';

function challenge(address: string, nonce: string, expiresAt: Date) {
  return `Sign in to LATCHWORK\n\nDomain: ${process.env.AUTH_DOMAIN || 'localhost'}\nAddress: ${address.toLowerCase()}\nNonce: ${nonce}\nExpires: ${expiresAt.toISOString()}`;
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Generate Nonce for SIWE
  fastify.post('/nonce', async (req, reply) => {
    const { address } = (req.body || {}) as { address: Address };
    if (!address || !isAddress(address)) {
      return reply.status(400).send({ error: 'Valid wallet address required' });
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await prisma.userSession.upsert({
      where: { address: address.toLowerCase() },
      update: { nonce, expiresAt },
      create: { address: address.toLowerCase(), nonce, expiresAt },
    });

    const message = challenge(address, nonce, expiresAt);
    return { nonce, message };
  });

  // Verify Signature and issue JWT
  fastify.post('/verify', async (req, reply) => {
    const { address, signature, message } = (req.body || {}) as {
      address: Address;
      signature: Hex;
      message: string;
    };

    if (!address || !isAddress(address) || typeof signature !== 'string' || typeof message !== 'string') {
      return reply.status(400).send({ error: 'Missing parameters' });
    }

    const session = await prisma.userSession.findUnique({
      where: { address: address.toLowerCase() },
    });

    if (!session || !session.nonce || session.expiresAt < new Date()) {
      return reply.status(401).send({ error: 'Expired or invalid nonce' });
    }

    if (message !== challenge(address, session.nonce, session.expiresAt)) {
      return reply.status(401).send({ error: 'Message nonce mismatch' });
    }

    // Verify ECDSA signature
    let recovered: Address;
    try {
      recovered = await recoverAddress({ hash: hashMessage(message), signature });
    } catch {
      return reply.status(401).send({ error: 'Invalid wallet signature' });
    }

    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return reply.status(401).send({ error: 'Invalid wallet signature' });
    }

    // Atomically consume the challenge before issuing credentials. Concurrent replays lose.
    const consumed = await prisma.userSession.updateMany({
      where: { address: address.toLowerCase(), nonce: session.nonce, expiresAt: { gt: new Date() } },
      data: { nonce: '', token: null, expiresAt: new Date() },
    });
    if (consumed.count !== 1) {
      return reply.status(401).send({ error: 'Nonce already consumed or expired' });
    }

    // Sign JWT token
    const token = fastify.jwt.sign(
      { address: address.toLowerCase() },
      { expiresIn: '7d' }
    );

    return { token, address: address.toLowerCase() };
  });

  // Fetch current session
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (req) => {
    const user = (req as any).user;
    const orgs = await prisma.organization.findMany({
      where: { ownerAddress: user.address.toLowerCase() },
    });

    return {
      authenticated: true,
      address: user.address,
      organizations: orgs,
    };
  });
};

