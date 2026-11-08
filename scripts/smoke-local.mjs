// Local HTTP integration only: no blockchain transactions or verified deposits.
// Run after pnpm build: node scripts/smoke-local.mjs
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { keccak256, stringToBytes, verifyMessage } from 'viem';
import { verifyWitnessReportSignature } from '@latchwork/shared';

const root = fileURLToPath(new URL('../', import.meta.url));
const scriptPath = fileURLToPath(import.meta.url);
const verifyingContract = '0x0000000000000000000000000000000000001234';

function receiptPayload(receipt) {
  return {
    receiptId: `rcpt_${receipt.requestId}`,
    agreementId: receipt.agreementId,
    epochId: receipt.epochId,
    requestId: receipt.requestId,
    timestamp: Math.floor(new Date(receipt.timestamp).getTime() / 1000),
    latencyMs: receipt.latencyMs,
    statusCode: receipt.statusCode,
    requestHash: receipt.requestHash,
    responseHash: receipt.responseHash,
  };
}

function signedReport(record) {
  const timestamp = value => BigInt(
    value instanceof Date || (typeof value === 'string' && value.includes('T'))
      ? Math.floor(new Date(value).getTime() / 1000)
      : value,
  );
  return {
    agreementId: record.agreementId,
    epochId: BigInt(record.epochId),
    chainId: BigInt(record.chainId),
    witness: record.witness || record.witnessAddress,
    measurementStart: timestamp(record.measurementStart),
    measurementEnd: timestamp(record.measurementEnd),
    observationCount: BigInt(record.observationCount),
    availabilityPpm: BigInt(record.availabilityPpm),
    p95LatencyMs: BigInt(record.p95LatencyMs),
    evidenceHash: record.evidenceHash,
    reportNonce: BigInt(record.reportNonce),
    deadline: timestamp(record.deadline),
    signature: record.signature,
  };
}

async function verifyDurabilityInNewProcess() {
  const { prisma } = await import('../packages/database/dist/index.js');
  try {
    const agreementId = process.env.LATCHWORK_SMOKE_AGREEMENT_ID;
    const receipt = await prisma.usageReceiptRecord.findUnique({ where: { requestId: process.env.LATCHWORK_SMOKE_REQUEST_ID } });
    assert.ok(receipt, 'Receipt survives a new database connection in a new process');
    assert.equal(receipt.agreementId, agreementId);
    assert.equal(await verifyMessage({ address: process.env.LATCHWORK_SMOKE_GATEWAY_SIGNER, message: JSON.stringify(receiptPayload(receipt)), signature: receipt.signature }), true);
    const reports = await prisma.witnessReportRecord.findMany({ where: { agreementId, epochId: 1 } });
    assert.equal(reports.length, 3, 'All three reports survive process restart');
    for (const record of reports) {
      const report = signedReport(record);
      assert.equal((await verifyWitnessReportSignature(report, report.signature, verifyingContract)).isValid, true);
    }
    assert.equal(await prisma.agreement.count({ where: { id: agreementId } }), 1);
    assert.equal(await prisma.settlementRecord.count(), 0, 'No settlement or funding evidence is fabricated');
    console.log('PASS: new process reopened SQLite; agreement, receipt and three valid signed reports persisted.');
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const directory = await mkdtemp(path.join(tmpdir(), 'latchwork-smoke-'));
  const dbPath = path.join(directory, 'smoke.db');
  let prisma;
  let upstream;
  let servers = [];
  const checks = [];
  const pass = (name) => { checks.push(name); console.log(`PASS: ${name}`); };
  try {
    // Override inherited credentials: every signer below is ephemeral and local.
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = `file:${dbPath.replaceAll('\\', '/')}`;
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    process.env.MONITOR_API_TOKEN = randomBytes(32).toString('hex');
    process.env.AUTH_DOMAIN = 'smoke.latchwork.local';
    process.env.ALLOW_LOCAL_UPSTREAMS = 'true';
    process.env.GATEWAY_SIGNER_PRIVATE_KEY = generatePrivateKey();
    for (let i = 1; i <= 3; i++) process.env[`WITNESS_${i}_PRIVATE_KEY`] = generatePrivateKey();
    await writeFile(dbPath, '');
    const databaseRequire = createRequire(new URL('../packages/database/package.json', import.meta.url));
    const prismaCli = databaseRequire.resolve('prisma/build/index.js');
    const initialized = spawnSync(process.execPath, [prismaCli, 'db', 'push', '--skip-generate', '--schema', path.join(root, 'packages/database/prisma/schema.prisma')], {
      cwd: root, env: process.env, encoding: 'utf8', timeout: 60_000, windowsHide: true,
    });
    assert.equal(initialized.status, 0, `Temporary SQLite initialization failed: ${initialized.stderr || initialized.stdout}`);
    pass('fresh isolated SQLite schema initialized without regenerating Prisma');

    ({ prisma } = await import('../packages/database/dist/index.js'));
    const { buildApiServer } = await import('../apps/api/dist/server.js');
    const { buildGatewayServer } = await import('../apps/gateway/dist/server.js');
    const { buildMonitorServer } = await import('../apps/monitor/dist/server.js');

    let challenge = '';
    const upstreamRequests = [];
    upstream = createServer(async (req, res) => {
      if (req.url === '/.well-known/latchwork-challenge') {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end(challenge);
        return;
      }
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString('utf8');
      upstreamRequests.push({ url: req.url, method: req.method, headers: req.headers, body });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, path: req.url, method: req.method, body }));
    });
    upstream.listen(0, '127.0.0.1');
    await once(upstream, 'listening');
    const upstreamUrl = `http://127.0.0.1:${upstream.address().port}`;

    const api = buildApiServer();
    const gateway = buildGatewayServer();
    const monitor = buildMonitorServer();
    servers = [api, gateway, monitor];
    const [apiUrl, gatewayUrl, monitorUrl] = await Promise.all(servers.map(server => server.listen({ port: 0, host: '127.0.0.1' })));
    async function request(base, route, { method = 'GET', token, key, body, expected = 200 } = {}) {
      const response = await fetch(`${base}${route}`, {
        method,
        headers: {
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(key ? { 'x-latchwork-key': key } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15_000),
      });
      const raw = await response.text();
      let data;
      try { data = JSON.parse(raw); } catch { data = raw; }
      assert.equal(response.status, expected, `${method} ${route}: expected ${expected}; got ${response.status}: ${raw}`);
      return { data, raw, headers: response.headers };
    }

    async function login() {
      const account = privateKeyToAccount(generatePrivateKey());
      const { data: nonce } = await request(apiUrl, '/auth/nonce', { method: 'POST', body: { address: account.address } });
      const credentials = { address: account.address, message: nonce.message, signature: await account.signMessage({ message: nonce.message }) };
      const { data: session } = await request(apiUrl, '/auth/verify', { method: 'POST', body: credentials });
      await request(apiUrl, '/auth/verify', { method: 'POST', body: credentials, expected: 401 });
      const { data: me } = await request(apiUrl, '/auth/me', { token: session.token });
      assert.equal(me.address, account.address.toLowerCase());
      return { account, token: session.token };
    }

    const provider = await login();
    const customer = await login();
    pass('provider and customer authenticate with real wallet signatures; consumed challenges reject replay');
    await request(apiUrl, '/orgs/', { method: 'POST', body: { name: 'Unauthorized', slug: 'unauthorized' }, expected: 401 });
    const suffix = randomBytes(6).toString('hex');
    const { data: org } = await request(apiUrl, '/orgs/', { method: 'POST', token: provider.token, body: { name: 'Local Smoke Provider', slug: `smoke-org-${suffix}` } });
    const { data: service } = await request(apiUrl, '/services/', { method: 'POST', token: provider.token, body: { orgId: org.id, name: 'Measured Echo API', slug: `smoke-echo-${suffix}`, description: 'Temporary loopback echo service', upstreamUrl, category: 'Developer Tools' } });
    challenge = service.verificationChallenge;
    await request(apiUrl, `/services/${service.id}/verify`, { method: 'POST', token: customer.token, body: {}, expected: 403 });
    const { data: verified } = await request(apiUrl, `/services/${service.id}/verify`, { method: 'POST', token: provider.token, body: {} });
    assert.equal(verified.verified, true);
    const { data: plan } = await request(apiUrl, `/services/${service.id}/plans`, { method: 'POST', token: provider.token, body: { name: 'Smoke Plan', slug: `smoke-plan-${suffix}`, description: 'Local sandbox only', pricePerEpochUsdc: 1, requestQuota: 20, rateLimitRps: 20, slaUptimePpm: 995000, slaLatencyMs: 250 } });
    const { data: marketplace } = await request(apiUrl, '/services/');
    assert.ok(marketplace.some(item => item.id === service.id && item.isVerified && item.plans.some(item => item.id === plan.id)));
    pass('provider registers organization, verifies hosted ownership challenge and publishes a marketplace plan');

    const agreementId = `0x${randomBytes(32).toString('hex')}`;
    const agreementBody = { id: agreementId, serviceId: service.id, planId: plan.id, providerAddress: provider.account.address, totalFundedUsdc: 0, epochDurationSeconds: 60, circuitPolicyId: 'LOCAL_SMOKE_ONLY' };
    const { data: activated } = await request(apiUrl, '/agreements/', { method: 'POST', token: customer.token, body: agreementBody });
    assert.equal(activated.mode, 'LOCAL_SANDBOX');
    assert.equal(activated.fundingVerified, false);
    assert.ok(activated.apiKey);
    await request(apiUrl, '/agreements/', { method: 'POST', token: customer.token, body: agreementBody, expected: 409 });
    pass('customer creates explicitly unfunded sandbox agreement and receives a real gateway credential; duplicate recording rejects replay');

    const pathWithQuery = '/echo?source=smoke';
    const requestBody = { message: `actual-forwarding-${suffix}` };
    const { data: echo, raw: echoRaw, headers } = await request(gatewayUrl, `/v1/service/${service.slug}${pathWithQuery}`, { method: 'POST', key: activated.apiKey, body: requestBody });
    assert.equal(echo.path, pathWithQuery);
    assert.equal(echo.method, 'POST');
    assert.deepEqual(JSON.parse(echo.body), requestBody);
    assert.equal(upstreamRequests.length, 1);
    assert.equal(upstreamRequests[0].headers['x-latchwork-key'], undefined);
    assert.equal(upstreamRequests[0].headers.authorization, undefined);
    const receiptId = headers.get('x-latchwork-receipt-id');
    const { data: receipt } = await request(gatewayUrl, `/v1/receipts/${receiptId}`, { key: activated.apiKey });
    const { data: gatewayHealth } = await request(gatewayUrl, '/health');
    assert.equal(receipt.agreementId, agreementId);
    assert.equal(receipt.requestHash, keccak256(stringToBytes(JSON.stringify(requestBody))));
    assert.equal(receipt.responseHash, keccak256(stringToBytes(echoRaw)));
    assert.equal(headers.get('x-latchwork-receipt-signature'), receipt.signature);
    assert.equal(await verifyMessage({ address: gatewayHealth.gatewaySigner, message: JSON.stringify(receiptPayload(receipt)), signature: receipt.signature }), true);
    pass('gateway forwards actual HTTP method, body and query; persists verifiable signed request/response receipt without forwarding credentials');

    const forwardedBeforeRejections = upstreamRequests.length;
    await request(gatewayUrl, `/v1/service/${service.slug}/echo`, { key: 'invalid-credential', expected: 401 });
    await request(gatewayUrl, `/v1/service/another-service-${suffix}/echo`, { key: activated.apiKey, expected: 403 });
    await request(gatewayUrl, `/v1/receipts/${receiptId}`, { expected: 401 });
    assert.equal(upstreamRequests.length, forwardedBeforeRejections);
    pass('gateway rejects invalid credentials, cross-service key use and unauthenticated receipt reads before forwarding');

    const monitorToken = process.env.MONITOR_API_TOKEN;
    const reportBody = { agreementId, epochId: 1, chainId: 31337, verifyingContract, baseNonce: 1 };
    await request(monitorUrl, '/probe', { method: 'POST', body: { agreementId, epochId: 1 }, expected: 401 });
    await request(monitorUrl, '/reports/quorum-batch', { method: 'POST', token: monitorToken, body: reportBody, expected: 409 });
    await request(monitorUrl, '/probe', { method: 'POST', token: monitorToken, body: { agreementId, epochId: 1, path: 'http://unregistered.invalid/' }, expected: 400 });
    const { data: probes } = await request(monitorUrl, '/probe', { method: 'POST', token: monitorToken, body: { agreementId, epochId: 1, path: '/health' } });
    assert.equal(probes.observations.length, 3);
    assert.ok(probes.observations.every(item => item.observation.success));
    const { data: batch } = await request(monitorUrl, '/reports/quorum-batch', { method: 'POST', token: monitorToken, body: reportBody });
    assert.equal(batch.count, 3);
    assert.equal(new Set(batch.reports.map(report => report.witness.toLowerCase())).size, 3);
    for (const record of batch.reports) {
      const report = signedReport(record);
      assert.equal(report.observationCount, 1n);
      assert.equal(report.availabilityPpm, 1_000_000n);
      assert.equal((await verifyWitnessReportSignature(report, report.signature, verifyingContract)).isValid, true);
      assert.equal((await verifyWitnessReportSignature({ ...report, availabilityPpm: 0n }, report.signature, verifyingContract)).isValid, false);
    }
    const { data: withEvidence } = await request(apiUrl, `/agreements/${agreementId}`, { token: customer.token });
    assert.equal(withEvidence.usageReceipts.length, 1);
    assert.equal(withEvidence.witnessReports.length, 3);
    assert.equal(withEvidence.settlements.length, 0);
    pass('monitor probes only registered agreement origin, signs three measured reports, rejects unsigned operator requests/unmeasured reports; tampered signatures fail');

    await Promise.all(servers.map(server => server.close()));
    servers = [];
    await prisma.$disconnect();
    const reopened = spawnSync(process.execPath, [scriptPath, '--verify-durable'], {
      cwd: root,
      env: { ...process.env, LATCHWORK_SMOKE_AGREEMENT_ID: agreementId, LATCHWORK_SMOKE_REQUEST_ID: receipt.requestId, LATCHWORK_SMOKE_GATEWAY_SIGNER: gatewayHealth.gatewaySigner },
      encoding: 'utf8', timeout: 30_000, windowsHide: true,
    });
    assert.equal(reopened.status, 0, `Durability subprocess failed: ${reopened.stderr || reopened.stdout}`);
    console.log(reopened.stdout.trim());
    pass('durable agreement, receipt and three report signatures verified again after service shutdown in a separate process');
    console.log(JSON.stringify({ result: 'PASS', checks: checks.length, mode: 'LOCAL_HTTP_SANDBOX', blockchainTransactions: 0, fundingVerified: false, upstreamRequests: upstreamRequests.length, durableReceipts: 1, durableWitnessReports: 3 }, null, 2));
    console.log('Not exercised: on-chain funding, contract-valid complete epoch windows, circuit deployment, settlement or withdrawals.');
  } finally {
    await Promise.allSettled(servers.map(server => server.close()));
    if (prisma) await prisma.$disconnect();
    if (upstream?.listening) {
      upstream.closeAllConnections();
      await new Promise((resolve, reject) => upstream.close(error => error ? reject(error) : resolve()));
    }
    const cleanupTarget = path.resolve(directory);
    assert.equal(path.dirname(cleanupTarget), path.resolve(tmpdir()), 'Cleanup must remain inside the temporary directory root');
    assert.ok(path.basename(cleanupTarget).startsWith('latchwork-smoke-'), 'Cleanup only removes this smoke run directory');
    await rm(cleanupTarget, { recursive: true, force: true });
  }
}

(process.argv.includes('--verify-durable') ? verifyDurabilityInNewProcess() : main()).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
