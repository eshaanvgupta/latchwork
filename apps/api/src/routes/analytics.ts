import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@latchwork/database';
import { CHAINS } from '@latchwork/shared';

export const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/overview', async () => {
    const totalServices = await prisma.service.count();
    const activeAgreements = await prisma.agreement.count({ where: { status: 'ACTIVE' } });
    const totalReceipts = await prisma.usageReceiptRecord.count();
    const totalSettlements = await prisma.settlementRecord.count();
    const openDisputes = await prisma.disputeRecord.count({ where: { status: 'OPEN' } });

    // Aggregate financial amounts
    const agreements = await prisma.agreement.findMany({
      select: {
        totalFundedUsdc: true,
        spentAmountUsdc: true,
        refundedAmountUsdc: true,
      },
    });

    const totalEscrowUsdc = agreements.reduce((acc, a) => acc + (a.totalFundedUsdc - a.spentAmountUsdc - a.refundedAmountUsdc), 0);
    const totalProviderEarningsUsdc = agreements.reduce((acc, a) => acc + a.spentAmountUsdc, 0);
    const totalRefundsUsdc = agreements.reduce((acc, a) => acc + a.refundedAmountUsdc, 0);

    // Recent receipts for latency metrics
    const recentReceipts = await prisma.usageReceiptRecord.findMany({
      take: 100,
      orderBy: { timestamp: 'desc' },
      select: { latencyMs: true, statusCode: true, timestamp: true },
    });

    const avgLatency = recentReceipts.length > 0
      ? Math.round(recentReceipts.reduce((a, b) => a + b.latencyMs, 0) / recentReceipts.length)
      : null;

    const successfulRequests = recentReceipts.filter((r) => r.statusCode >= 200 && r.statusCode < 400).length;
    const availabilityPercent = recentReceipts.length > 0
      ? Number(((successfulRequests / recentReceipts.length) * 100).toFixed(2))
      : null;

    return {
      overview: {
        activeAgreements,
        totalServices,
        totalEscrowUsdc,
        totalProviderEarningsUsdc,
        totalRefundsUsdc,
        totalRequests: totalReceipts,
        openDisputes,
        avgLatencyMs: avgLatency,
        availabilityPercent,
      },
      blockchain: {
        network: CHAINS.XLAYER_MAINNET.name,
        chainId: CHAINS.XLAYER_MAINNET.id,
        gasToken: CHAINS.XLAYER_MAINNET.currency.symbol,
        healthy: null,
        lastIndexedBlock: null,
        indexingConfigured: false,
        financialDataSource: 'local-database-unverified',
      },
      recentLatencySamples: recentReceipts.slice(0, 20),
      timestamp: new Date().toISOString(),
    };
  });
};

