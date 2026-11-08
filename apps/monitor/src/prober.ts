import { request as undiciRequest } from 'undici';
import { keccak256, stringToBytes, type Hex } from 'viem';
import { upstreamDispatcher } from './upstream.js';

export interface Observation {
  timestamp: number;
  statusCode: number;
  latencyMs: number;
  success: boolean;
}

export interface MetricSummary {
  observationCount: number;
  availabilityPpm: number; // 1,000,000 = 100%
  p95LatencyMs: number;
  evidenceHash: Hex;
  measurementStart: number;
  measurementEnd: number;
}

export class ServiceProber {
  private observations: Observation[] = [];

  public async probeEndpoint(targetUrl: string): Promise<Observation> {
    const start = performance.now();
    let statusCode = 504;
    let success = false;

    let dispatcher: Awaited<ReturnType<typeof upstreamDispatcher>> | undefined;
    try {
      dispatcher = await upstreamDispatcher(new URL(targetUrl), process.env.ALLOW_LOCAL_UPSTREAMS === 'true' && process.env.NODE_ENV !== 'production');
      const res = await undiciRequest(targetUrl, {
        dispatcher,
        method: 'GET',
        headersTimeout: 5000,
        bodyTimeout: 5000,
        signal: AbortSignal.timeout(10000),
      });
      statusCode = res.statusCode;
      success = statusCode >= 200 && statusCode < 400;
      await res.body.dump();
    } catch (err) {
      statusCode = 503;
      success = false;
    } finally {
      await dispatcher?.close();
    }

    const latencyMs = Math.round(performance.now() - start);
    const obs: Observation = {
      timestamp: Math.floor(Date.now() / 1000),
      statusCode,
      latencyMs,
      success,
    };

    this.observations.push(obs);
    return obs;
  }

  public getSummary(): MetricSummary {
    if (this.observations.length === 0) {
      return {
        observationCount: 0,
        availabilityPpm: 0,
        p95LatencyMs: 0,
        evidenceHash: keccak256(stringToBytes('empty_evidence')),
        measurementStart: 0,
        measurementEnd: 0,
      };
    }

    const successful = this.observations.filter((o) => o.success).length;
    const availabilityPpm = Math.round((successful / this.observations.length) * 1000000);

    const sortedLatencies = [...this.observations.map((o) => o.latencyMs)].sort((a, b) => a - b);
    const p95Idx = Math.floor(sortedLatencies.length * 0.95);
    const p95LatencyMs = sortedLatencies[p95Idx] ?? sortedLatencies[sortedLatencies.length - 1];

    const evidenceHash = keccak256(stringToBytes(JSON.stringify(this.observations)));

    return {
      observationCount: this.observations.length,
      availabilityPpm,
      p95LatencyMs,
      evidenceHash,
      measurementStart: this.observations[0].timestamp,
      measurementEnd: this.observations[this.observations.length - 1].timestamp,
    };
  }

  public clear() {
    this.observations = [];
  }
}

