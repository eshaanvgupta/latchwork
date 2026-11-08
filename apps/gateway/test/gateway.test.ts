import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildGatewayServer } from '../src/server.js';
import { isSafeUpstreamUrl } from '../src/ssrf.js';
import { rateLimiter } from '../src/rate-limiter.js';
import { createAndSignUsageReceipt, gatewaySignerAccount } from '../src/receipts.js';
import { recoverAddress, hashMessage } from 'viem';

describe('Gateway Subsystem', () => {
  const app = buildGatewayServer();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should respond to /health with gateway signer address', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('OK');
    expect(body.gatewaySigner).toBe(gatewaySignerAccount.address);
  });

  it('should prevent SSRF against AWS metadata endpoint', () => {
    const check1 = isSafeUpstreamUrl('http://169.254.169.254/latest/meta-data');
    expect(check1.safe).toBe(false);

    const check2 = isSafeUpstreamUrl('ftp://example.com/api');
    expect(check2.safe).toBe(false);

    const check3 = isSafeUpstreamUrl('https://api.openai.com/v1/chat');
    expect(check3.safe).toBe(true);
  });

  it('should rate limit requests when bucket is exhausted', () => {
    const testKey = 'test-ratelimit-client';
    const opts = { capacity: 2, refillRateRps: 1 };

    // First two requests should pass
    expect(rateLimiter.check(testKey, opts).allowed).toBe(true);
    expect(rateLimiter.check(testKey, opts).allowed).toBe(true);

    // Third immediate request should be rejected
    expect(rateLimiter.check(testKey, opts).allowed).toBe(false);
  });

  it('should generate verifiable signed usage receipts', async () => {
    const receipt = await createAndSignUsageReceipt({
      agreementId: '0x1111111111111111111111111111111111111111111111111111111111111111',
      epochId: 1,
      requestId: 'req_test_001',
      latencyMs: 38,
      statusCode: 200,
      requestBody: '{"model":"gpt-4"}',
      responseBody: '{"choices":[{"text":"hello"}]}',
      persist: false,
    });

    expect(receipt.signature).toBeDefined();
    expect(receipt.latencyMs).toBe(38);

    // Verify ECDSA signature against gatewaySignerAccount
    const payload = JSON.stringify({
      receiptId: receipt.receiptId,
      agreementId: receipt.agreementId,
      epochId: receipt.epochId,
      requestId: receipt.requestId,
      timestamp: receipt.timestamp,
      latencyMs: receipt.latencyMs,
      statusCode: receipt.statusCode,
      requestHash: receipt.requestHash,
      responseHash: receipt.responseHash,
    });

    const recovered = await recoverAddress({
      hash: hashMessage(payload),
      signature: receipt.signature,
    });

    expect(recovered.toLowerCase()).toBe(gatewaySignerAccount.address.toLowerCase());
  });
});

