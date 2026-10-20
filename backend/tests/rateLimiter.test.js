import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTokenBucketLimiter, createSlidingWindowLimiter } from '../src/middlewares/rateLimiter.middleware.js';
import { getRedisClient } from '../src/config/redis.js';

describe('Distributed Rate Limiter Middleware (Token Bucket & Sliding Window)', () => {
  let redis;

  beforeAll(async () => {
    redis = getRedisClient();
    await redis.ping();
  });

  afterAll(async () => {
    // Clean up test rate limit keys
    const keys = await redis.keys('rl:test:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  describe('Token Bucket Algorithm (Burst-Tolerant)', () => {
    it('permits burst up to bucket capacity and rejects subsequent requests', async () => {
      const limiter = createTokenBucketLimiter({
        capacity: 3,
        refillRatePerSec: 1 / 30, // 1 token every 30s
        keyPrefix: 'rl:test:tb',
        keyGenerator: () => 'user-test-burst'
      });

      const mockRes = () => {
        const res = {
          headers: {},
          statusCode: 200,
          setHeader(k, v) { this.headers[k] = v; },
          status(code) { this.statusCode = code; return this; },
          json(data) { this.body = data; return this; }
        };
        return res;
      };

      // 1st request -> should pass
      let nextCalled = false;
      const res1 = mockRes();
      await limiter({}, res1, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
      expect(res1.headers['X-RateLimit-Remaining']).toBe(2);

      // 2nd request -> should pass
      nextCalled = false;
      const res2 = mockRes();
      await limiter({}, res2, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
      expect(res2.headers['X-RateLimit-Remaining']).toBe(1);

      // 3rd request -> should pass (bucket empty now)
      nextCalled = false;
      const res3 = mockRes();
      await limiter({}, res3, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
      expect(res3.headers['X-RateLimit-Remaining']).toBe(0);

      // 4th request -> should be throttled (HTTP 429)
      nextCalled = false;
      const res4 = mockRes();
      await limiter({}, res4, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(res4.statusCode).toBe(429);
      expect(res4.body.success).toBe(false);
      expect(res4.headers['Retry-After']).toBeGreaterThan(0);
      expect(res4.body.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('Sliding Window Log Algorithm (Strict Boundary)', () => {
    it('enforces request limit over sliding window and rejects overflow', async () => {
      const limiter = createSlidingWindowLimiter({
        windowMs: 5000,
        maxRequests: 2,
        keyPrefix: 'rl:test:sw',
        keyGenerator: () => 'user-test-sw'
      });

      const mockRes = () => {
        const res = {
          headers: {},
          statusCode: 200,
          setHeader(k, v) { this.headers[k] = v; },
          status(code) { this.statusCode = code; return this; },
          json(data) { this.body = data; return this; }
        };
        return res;
      };

      // 1st request -> pass
      let next1 = false;
      const res1 = mockRes();
      await limiter({}, res1, () => { next1 = true; });
      expect(next1).toBe(true);
      expect(res1.headers['X-RateLimit-Remaining']).toBe(1);

      // 2nd request -> pass
      let next2 = false;
      const res2 = mockRes();
      await limiter({}, res2, () => { next2 = true; });
      expect(next2).toBe(true);
      expect(res2.headers['X-RateLimit-Remaining']).toBe(0);

      // 3rd request -> block with HTTP 429
      let next3 = false;
      const res3 = mockRes();
      await limiter({}, res3, () => { next3 = true; });
      expect(next3).toBe(false);
      expect(res3.statusCode).toBe(429);
      expect(res3.body.success).toBe(false);
      expect(res3.headers['Retry-After']).toBeGreaterThan(0);
    });

    it('skips requests when skip function evaluates to true', async () => {
      const limiter = createSlidingWindowLimiter({
        windowMs: 5000,
        maxRequests: 1,
        keyPrefix: 'rl:test:sw_skip',
        skip: (req) => req.path === '/health'
      });

      let nextCalled = false;
      const res = { setHeader() {}, status() { return this; }, json() {} };
      await limiter({ path: '/health' }, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });
  });
});
