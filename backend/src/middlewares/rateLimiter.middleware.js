import crypto from 'crypto';
import { getRedisClient } from '../config/redis.js';

// ============================================================================
// REDIS LUA SCRIPTS (ATOMIC EXECUTION)
// ============================================================================

/**
 * Token Bucket Lua Script
 * KEYS[1]: Redis hash key
 * ARGV[1]: Bucket capacity (number)
 * ARGV[2]: Refill rate in tokens per second (float)
 * ARGV[3]: Cost per request (default 1)
 * ARGV[4]: Current timestamp in milliseconds
 * ARGV[5]: TTL in seconds
 * Returns: [allowed (0 or 1), remainingTokens, retryAfterSeconds]
 */
const TOKEN_BUCKET_LUA = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local now = tonumber(ARGV[4])
local ttlSec = tonumber(ARGV[5])

local data = redis.call('HMGET', key, 'tokens', 'lastRefill')
local tokens = tonumber(data[1])
local lastRefill = tonumber(data[2])

if tokens == nil then
  tokens = capacity
  lastRefill = now
else
  local elapsedSec = math.max(0, (now - lastRefill) / 1000)
  tokens = math.min(capacity, tokens + (elapsedSec * refillRate))
  lastRefill = now
end

if tokens >= cost then
  tokens = tokens - cost
  redis.call('HMSET', key, 'tokens', tostring(tokens), 'lastRefill', tostring(lastRefill))
  redis.call('EXPIRE', key, ttlSec)
  return {1, math.floor(tokens), 0}
else
  redis.call('HMSET', key, 'tokens', tostring(tokens), 'lastRefill', tostring(lastRefill))
  redis.call('EXPIRE', key, ttlSec)
  local deficit = cost - tokens
  local retryAfterSec = math.ceil(deficit / refillRate)
  return {0, math.floor(tokens), math.max(1, retryAfterSec)}
end
`;

/**
 * Sliding Window Log Lua Script
 * KEYS[1]: Redis sorted set key
 * ARGV[1]: Current timestamp in milliseconds
 * ARGV[2]: Window size in milliseconds
 * ARGV[3]: Max requests allowed in window
 * ARGV[4]: Unique member ID (timestamp:uuid)
 * Returns: [allowed (0 or 1), remainingRequests, retryAfterSeconds]
 */
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local maxLimit = tonumber(ARGV[3])
local memberId = ARGV[4]
local clearBefore = now - windowMs

redis.call('ZREMRANGEBYSCORE', key, '-inf', clearBefore)
local currentCount = redis.call('ZCARD', key)

if currentCount < maxLimit then
  redis.call('ZADD', key, now, memberId)
  redis.call('PEXPIRE', key, windowMs)
  return {1, maxLimit - (currentCount + 1), 0}
else
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retryAfterSec = 1
  if oldest[2] ~= nil then
    local oldestTime = tonumber(oldest[2])
    local resetMs = (oldestTime + windowMs) - now
    retryAfterSec = math.max(1, math.ceil(resetMs / 1000))
  else
    retryAfterSec = math.ceil(windowMs / 1000)
  end
  return {0, 0, retryAfterSec}
end
`;

// ============================================================================
// RATE LIMITER FACTORIES
// ============================================================================

/**
 * Creates a Token Bucket Rate Limiter middleware.
 * Ideal for endpoints that require burst tolerance (e.g. SOS alerts, LLM prompts).
 *
 * @param {Object} options
 * @param {number} options.capacity Max tokens the bucket can hold (burst limit)
 * @param {number} options.refillRatePerSec Tokens added per second (e.g. 1/30 for 1 token per 30s)
 * @param {string} options.keyPrefix Redis key prefix
 * @param {Function} [options.keyGenerator] Custom function (req) => string
 * @param {string} [options.message] Custom 429 error message
 */
export const createTokenBucketLimiter = ({
  capacity = 3,
  refillRatePerSec = 1 / 30,
  keyPrefix = 'rl:tb',
  keyGenerator,
  message = 'Too many requests. Burst quota exceeded, please slow down.'
}) => {
  return async (req, res, next) => {
    try {
      const redis = getRedisClient();
      const identifier = keyGenerator
        ? keyGenerator(req)
        : (req.user?._id?.toString() || req.ip || 'unknown');
      const redisKey = `${keyPrefix}:${identifier}`;

      const now = Date.now();
      // TTL set to twice the time it takes to refill a completely empty bucket, minimum 60s
      const ttlSec = Math.max(60, Math.ceil((capacity / refillRatePerSec) * 2));

      const result = await redis.eval(
        TOKEN_BUCKET_LUA,
        1,
        redisKey,
        capacity.toString(),
        refillRatePerSec.toString(),
        '1', // cost
        now.toString(),
        ttlSec.toString()
      );

      const [allowed, remaining, retryAfter] = result;

      res.setHeader('X-RateLimit-Limit', capacity);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining));

      if (allowed === 1) {
        return next();
      }

      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        statusCode: 429,
        success: false,
        message,
        retryAfter
      });
    } catch (err) {
      // Fail-open for high availability (especially critical for life-safety emergency endpoints)
      console.warn(`[RateLimiter:${keyPrefix}] Redis evaluation failed, failing open:`, err.message);
      return next();
    }
  };
};

/**
 * Creates a Sliding Window Log Rate Limiter middleware using Redis Sorted Sets.
 * Ideal for strict protection against brute-force attacks with no reset-boundary gaps.
 *
 * @param {Object} options
 * @param {number} options.windowMs Window duration in milliseconds (e.g. 15 * 60 * 1000)
 * @param {number} options.maxRequests Max requests allowed within window
 * @param {string} options.keyPrefix Redis key prefix
 * @param {Function} [options.keyGenerator] Custom function (req) => string
 * @param {string} [options.message] Custom 429 error message
 * @param {Function} [options.skip] Optional filter function (req) => boolean
 */
export const createSlidingWindowLimiter = ({
  windowMs = 60 * 1000,
  maxRequests = 100,
  keyPrefix = 'rl:sw',
  keyGenerator,
  message = 'Too many requests. Please try again later.',
  skip
}) => {
  return async (req, res, next) => {
    if (skip && skip(req)) {
      return next();
    }

    try {
      const redis = getRedisClient();
      const identifier = keyGenerator
        ? keyGenerator(req)
        : (req.user?._id?.toString() || req.ip || 'unknown');
      const redisKey = `${keyPrefix}:${identifier}`;

      const now = Date.now();
      const memberId = `${now}:${crypto.randomUUID()}`;

      const result = await redis.eval(
        SLIDING_WINDOW_LUA,
        1,
        redisKey,
        now.toString(),
        windowMs.toString(),
        maxRequests.toString(),
        memberId
      );

      const [allowed, remaining, retryAfter] = result;

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining));
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + (retryAfter * 1000)) / 1000));

      if (allowed === 1) {
        return next();
      }

      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        statusCode: 429,
        success: false,
        message,
        retryAfter
      });
    } catch (err) {
      console.warn(`[RateLimiter:${keyPrefix}] Redis evaluation failed, failing open:`, err.message);
      return next();
    }
  };
};

// ============================================================================
// PRE-CONFIGURED PRODUCTION LIMITERS
// ============================================================================

/**
 * 1. Emergency SOS Dispatch Limiter (Token Bucket)
 * Capacity: 3 tokens (immediate panic burst)
 * Refill: 1 token every 30 seconds
 */
export const sosRateLimiter = createTokenBucketLimiter({
  capacity: 3,
  refillRatePerSec: 1 / 30, // 1 token every 30s
  keyPrefix: 'rl:tb:sos',
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  message: 'Emergency SOS rate limit exceeded. You can send a maximum of 3 burst alerts per 60 seconds.'
});

/**
 * 2. Auth / Login Protection Limiter (Sliding Window Log)
 * Limit: 5 attempts per 15 minutes (900,000 ms) per IP + target identifier
 */
export const authLoginRateLimiter = createSlidingWindowLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  keyPrefix: 'rl:sw:auth_login',
  keyGenerator: (req) => {
    const target = req.body?.email || req.body?.phone || 'unknown_target';
    return `${req.ip}:${target}`;
  },
  message: 'Too many login attempts. For your security, this account is temporarily throttled. Please try again in 15 minutes.'
});

/**
 * 3. AI Assistant Limiter (Token Bucket)
 * Capacity: 10 tokens (burst of conversational queries)
 * Refill: 1 token every 6 seconds (10 RPM quota)
 */
export const aiChatRateLimiter = createTokenBucketLimiter({
  capacity: 10,
  refillRatePerSec: 1 / 6, // 1 token every 6s
  keyPrefix: 'rl:tb:ai_chat',
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  message: 'AI Assistant rate limit reached. Please wait a moment before sending another message.'
});

/**
 * 4. Global API Tier Limiter (Sliding Window Log)
 * Limit: 120 requests per minute per IP across general API routes
 */
export const globalApiRateLimiter = createSlidingWindowLimiter({
  windowMs: 60 * 1000,
  maxRequests: 120,
  keyPrefix: 'rl:sw:global',
  keyGenerator: (req) => req.ip,
  message: 'API rate limit exceeded. Please throttle your client requests.',
  skip: (req) => req.path === '/health' || req.path.startsWith('/socket.io')
});
