import { request as undiciRequest } from 'undici';
import { isSafeUpstreamUrl, upstreamDispatcher } from './ssrf.js';
import { authenticateGatewayKey } from './credentials.js';
import { rateLimiter } from './rate-limiter.js';
import { createAndSignUsageReceipt } from './receipts.js';
import { prisma } from '@latchwork/database';
import { cryptoRandomString } from './utils.js';

export interface ProxyRequestParams {
  apiKey?: string;
  serviceSlug: string;
  path: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
  body?: string;
}

export interface ProxyResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  receipt?: any;
}

export async function proxyApiRequest(params: ProxyRequestParams): Promise<ProxyResponse> {
  const start = performance.now();
  const requestId = `req_${Date.now()}_${cryptoRandomString(8)}`;

  const key = await authenticateGatewayKey(params.apiKey);
  if (!key) return { statusCode: 401, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'Valid active gateway key required' }) };
  if (key.agreement.service.slug !== params.serviceSlug || key.agreement.service.status !== 'ACTIVE') {
    return { statusCode: 403, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'Gateway key does not grant access to this service' }) };
  }

  // 1. Lookup Service
  const service = await prisma.service.findUnique({
    where: { slug: params.serviceSlug },
    include: { plans: true },
  });

  if (!service) {
    return {
      statusCode: 404,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Service not found', serviceSlug: params.serviceSlug }),
    };
  }

  // 2. Validate SSRF
  const allowLocalhost = process.env.ALLOW_LOCAL_UPSTREAMS === 'true' && process.env.NODE_ENV !== 'production';
  const ssrfCheck = isSafeUpstreamUrl(service.upstreamUrl, allowLocalhost);
  if (!ssrfCheck.safe) {
    return {
      statusCode: 502,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Bad Gateway: Upstream URL rejected by security policy', reason: ssrfCheck.reason }),
    };
  }

  // 3. Rate limiting (Default 50 RPS, capacity 100)
  const clientKey = key.id;
  const rps = Math.max(1, key.agreement.plan.rateLimitRps);
  const rateLimitResult = rateLimiter.check(clientKey, { capacity: rps * 2, refillRateRps: rps });
  if (!rateLimitResult.allowed) {
    return {
      statusCode: 429,
      headers: {
        'content-type': 'application/json',
        'retry-after': '1',
      },
      body: JSON.stringify({ error: 'Too Many Requests: Rate limit exceeded' }),
    };
  }

  const agreementId = key.agreementId;
  const epochId = key.agreement.currentEpoch;
  const used = await prisma.usageReceiptRecord.count({ where: { agreementId, epochId } });
  if (used >= key.agreement.plan.requestQuota) {
    return { statusCode: 429, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'Agreement epoch request quota exhausted' }) };
  }

  // Preserve the configured origin even if the caller supplies //another-host.
  const target = new URL(service.upstreamUrl);
  const requested = new URL(`http://request.invalid${params.path.startsWith('/') ? params.path : `/${params.path}`}`);
  target.pathname = `${target.pathname.replace(/\/$/, '')}${requested.pathname}`;
  target.search = requested.search;
  const targetUrl = target.toString();

  const forwardedHeaders: Record<string, string> = {
    'x-forwarded-for': 'latchwork-gateway',
    'x-request-id': requestId,
  };

  if (params.headers['content-type']) {
    forwardedHeaders['content-type'] = String(params.headers['content-type']);
  }
  if (params.headers['accept']) {
    forwardedHeaders['accept'] = String(params.headers['accept']);
  }

  let upstreamStatus = 502;
  let upstreamBody = '';
  const upstreamHeaders: Record<string, string> = {};

  let dispatcher: Awaited<ReturnType<typeof upstreamDispatcher>> | undefined;
  try {
    dispatcher = await upstreamDispatcher(target, allowLocalhost);
    const upstreamRes = await undiciRequest(targetUrl, {
      dispatcher,
      method: params.method as any,
      headers: forwardedHeaders,
      body: params.body,
      headersTimeout: 10000,
      bodyTimeout: 10000,
      signal: AbortSignal.timeout(15000),
    });

    upstreamStatus = upstreamRes.statusCode;
    const chunks: Buffer[] = [];
    let responseBytes = 0;
    for await (const chunk of upstreamRes.body) {
      const bytes = Buffer.from(chunk);
      responseBytes += bytes.length;
      if (responseBytes > 8 * 1024 * 1024) {
        upstreamRes.body.destroy();
        throw new Error('Upstream response exceeds the gateway response limit');
      }
      chunks.push(bytes);
    }
    upstreamBody = Buffer.concat(chunks).toString('utf8');

    for (const [k, v] of Object.entries(upstreamRes.headers)) {
      if (v && typeof v === 'string' && !['connection', 'transfer-encoding', 'content-length', 'content-encoding', 'set-cookie'].includes(k)) {
        upstreamHeaders[k] = v;
      }
    }
  } catch (err: any) {
    upstreamStatus = 504;
    upstreamBody = JSON.stringify({ error: 'Upstream Gateway Timeout or Connection Error' });
  } finally {
    await dispatcher?.close();
  }

  const latencyMs = Math.round(performance.now() - start);

  // 5. Generate Signed Usage Receipt

  const receipt = await createAndSignUsageReceipt({
    agreementId,
    epochId,
    requestId,
    latencyMs,
    statusCode: upstreamStatus,
    requestBody: params.body || '',
    responseBody: upstreamBody,
  });

  return {
    statusCode: upstreamStatus,
    headers: {
      ...upstreamHeaders,
      'content-type': upstreamHeaders['content-type'] || 'application/json',
      'x-latchwork-request-id': requestId,
      'x-latchwork-latency-ms': latencyMs.toString(),
      'x-latchwork-receipt-id': receipt.receiptId,
      'x-latchwork-receipt-signature': receipt.signature,
    },
    body: upstreamBody,
    receipt,
  };
}

