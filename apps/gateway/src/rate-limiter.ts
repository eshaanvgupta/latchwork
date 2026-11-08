export interface RateLimiterOptions {
  capacity: number; // max burst
  refillRateRps: number; // tokens per second
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class TokenBucketRateLimiter {
  private buckets = new Map<string, Bucket>();

  public check(key: string, options: RateLimiterOptions): { allowed: boolean; remaining: number } {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = {
        tokens: options.capacity,
        lastRefill: now,
      };
      this.buckets.set(key, bucket);
    } else {
      const elapsedSeconds = (now - bucket.lastRefill) / 1000;
      bucket.tokens = Math.min(
        options.capacity,
        bucket.tokens + elapsedSeconds * options.refillRateRps
      );
      bucket.lastRefill = now;
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, remaining: Math.floor(bucket.tokens) };
    }

    return { allowed: false, remaining: 0 };
  }
}

export const rateLimiter = new TokenBucketRateLimiter();

