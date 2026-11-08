import { prisma } from './index.js';

export async function seedDatabase() {
  console.log('Seeding LATCHWORK database...');

  // Create Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'nexus-ai-labs' },
    update: {},
    create: {
      name: 'Nexus AI Labs',
      slug: 'nexus-ai-labs',
      ownerAddress: '0x25A71a07cecf1753ee65b00E0a3AAEf7e0F51c0F',
    },
  });

  // Create LATCHWORK Test Service (Section 8 of prompt)
  const testService = await prisma.service.upsert({
    where: { slug: 'latchwork-test-service' },
    update: {},
    create: {
      orgId: org.id,
      name: 'LATCHWORK Test Service',
      slug: 'latchwork-test-service',
      description: 'High-availability deterministic inference and chaos-simulation API for SLA verification.',
      upstreamUrl: process.env.TEST_SERVICE_URL || 'http://127.0.0.1:4002',
      category: 'AI & Inference',
      isVerified: true,
      verificationChallenge: 'latchwork-verify-challenge-001',
      providerAddress: '0x25A71a07cecf1753ee65b00E0a3AAEf7e0F51c0F',
      status: 'ACTIVE',
    },
  });

  // Create Service Plans
  const freePlan = await prisma.servicePlan.upsert({
    where: { id: 'plan-free-dev' },
    update: {},
    create: {
      id: 'plan-free-dev',
      serviceId: testService.id,
      name: 'Developer Sandbox',
      slug: 'free-dev',
      description: 'Free tier for development testing and circuit verification.',
      pricePerEpochUsdc: 0.0,
      requestQuota: 1000,
      rateLimitRps: 5,
      slaUptimePpm: 990000, // 99.0%
      slaLatencyMs: 500,
    },
  });

  const growthPlan = await prisma.servicePlan.upsert({
    where: { id: 'plan-growth-29' },
    update: {},
    create: {
      id: 'plan-growth-29',
      serviceId: testService.id,
      name: 'Growth Tier',
      slug: 'growth-29',
      description: 'Production tier for growing applications with strict SLA enforcement.',
      pricePerEpochUsdc: 29.0,
      requestQuota: 50000,
      rateLimitRps: 50,
      slaUptimePpm: 995000, // 99.5%
      slaLatencyMs: 250,
    },
  });

  const businessPlan = await prisma.servicePlan.upsert({
    where: { id: 'plan-business-149' },
    update: {},
    create: {
      id: 'plan-business-149',
      serviceId: testService.id,
      name: 'Enterprise Business Tier',
      slug: 'business-149',
      description: 'High-throughput enterprise service with 2-of-3 witness consensus and dispute protection.',
      pricePerEpochUsdc: 149.0,
      requestQuota: 500000,
      rateLimitRps: 200,
      slaUptimePpm: 999000, // 99.9%
      slaLatencyMs: 150,
    },
  });

  console.log(`Database seeded successfully! Org: ${org.name}, Service: ${testService.name}`);
}

if (process.argv[1]?.endsWith('seed.js') || process.argv[1]?.endsWith('seed.ts')) {
  seedDatabase()
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

