import { getRedisClient } from '../config/redis.js';

const IDEMPOTENCY_TTL_SECONDS = 86400; // Cache idempotent results for 24 hours
const LOCK_TTL_SECONDS = 120; // 2-minute lock during in-flight processing

/**
 * Express middleware for guaranteeing request idempotency across unreliable network connections.
 * Caches response in Redis under `idempotency:<userId>:<key>`.
 */
export const idempotencyMiddleware = async (req, res, next) => {
  const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

  // Skip if client did not supply an idempotency key
  if (!idempotencyKey) {
    return next();
  }

  const userId = req.user?._id?.toString() || 'anonymous';
  const redisKey = `idempotency:${userId}:${idempotencyKey}`;

  try {
    const redis = getRedisClient();

    // 1. Check existing record
    const existing = await redis.get(redisKey);

    if (existing) {
      if (existing === 'PROCESSING') {
        return res.status(409).json({
          statusCode: 409,
          success: false,
          message: 'A request with this Idempotency-Key is currently being processed. Please wait.'
        });
      }

      // Return cached response
      try {
        const cached = JSON.parse(existing);
        res.setHeader('X-Cache-Lookup', 'IDEMPOTENT-HIT');
        return res.status(cached.statusCode).json(cached.body);
      } catch (parseErr) {
        // If cached payload was corrupted, fall through to re-execute
      }
    }

    // 2. Acquire in-flight processing lock
    const acquired = await redis.set(redisKey, 'PROCESSING', 'EX', LOCK_TTL_SECONDS, 'NX');
    if (!acquired) {
      return res.status(409).json({
        statusCode: 409,
        success: false,
        message: 'Concurrent request detected for this Idempotency-Key. Please wait.'
      });
    }

    // 3. Intercept res.json to capture response payload
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      // Restore original res.json
      res.json = originalJson;

      // Only cache successful or client-accepted operations (e.g., 200, 201, 202)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const payloadToCache = {
          statusCode: res.statusCode,
          body
        };
        redis
          .set(redisKey, JSON.stringify(payloadToCache), 'EX', IDEMPOTENCY_TTL_SECONDS)
          .catch((err) => console.error('[Idempotency] Failed to cache response:', err.message));
      } else {
        // On client/server errors, release the processing lock so user can correct and retry
        redis.del(redisKey).catch(() => {});
      }

      res.setHeader('X-Cache-Lookup', 'IDEMPOTENT-MISS');
      return originalJson(body);
    };

    next();
  } catch (err) {
    console.warn('[Idempotency] Redis check failed, skipping idempotency guard:', err.message);
    next();
  }
};
