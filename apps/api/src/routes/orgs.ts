import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@latchwork/database';

export const orgRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user;
    const { name, slug } = req.body as { name: string; slug: string };

    if (!name || !slug) {
      return reply.status(400).send({ error: 'Name and slug required' });
    }

    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) {
      return reply.status(409).send({ error: 'Organization slug already taken' });
    }

    const org = await prisma.organization.create({
      data: {
        name,
        slug,
        ownerAddress: user.address.toLowerCase(),
      },
    });

    return org;
  });

  fastify.get('/', { preHandler: [fastify.authenticate] }, async (req) => {
    const user = (req as any).user;
    return await prisma.organization.findMany({
      where: { ownerAddress: user.address.toLowerCase() },
      include: { services: true },
    });
  });

  fastify.get('/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const org = await prisma.organization.findUnique({
      where: { slug },
      include: {
        services: {
          include: { plans: true },
        },
      },
    });

    if (!org) {
      return reply.status(404).send({ error: 'Organization not found' });
    }
    return org;
  });
};

