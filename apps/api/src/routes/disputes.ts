import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@latchwork/database';

export const disputeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => {
    return await prisma.disputeRecord.findMany({
      include: {
        agreement: {
          include: { service: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  fastify.post('/', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const user = (req as any).user;
    const body = req.body as {
      agreementId: string;
      epochId: number;
      reason: string;
      evidenceUri: string;
    };

    const agreement = await prisma.agreement.findUnique({ where: { id: body.agreementId } });
    if (!agreement || ![agreement.customerAddress, agreement.providerAddress].includes(user.address.toLowerCase())) {
      return reply.status(403).send({ error: 'Only agreement participants may raise a dispute' });
    }
    if (!Number.isSafeInteger(body.epochId) || body.epochId < 1 || typeof body.reason !== 'string' || !body.reason.trim()) {
      return reply.status(400).send({ error: 'Positive epoch and dispute reason required' });
    }

    const dispute = await prisma.disputeRecord.create({
      data: {
        agreementId: body.agreementId,
        epochId: body.epochId,
        claimantAddress: user.address.toLowerCase(),
        reason: body.reason,
        evidenceUri: body.evidenceUri,
        status: 'OPEN',
      },
    });

    return dispute;
  });

  fastify.post('/:id/resolve', { preHandler: [fastify.authenticate] }, async (req, reply) => {
    const resolver = process.env.DISPUTE_RESOLVER_ADDRESS?.toLowerCase();
    if (!resolver || resolver !== (req as any).user.address.toLowerCase()) {
      return reply.status(403).send({ error: 'Configured dispute resolver required' });
    }
    const { id } = req.params as { id: string };
    const { uphold } = req.body as { uphold: boolean };
    if (typeof uphold !== 'boolean') return reply.status(400).send({ error: 'Boolean uphold field required' });

    const updated = await prisma.disputeRecord.update({
      where: { id },
      data: {
        status: uphold ? 'UPHELD' : 'DISMISSED',
        resolvedAt: new Date(),
      },
    });

    return updated;
  });
};

