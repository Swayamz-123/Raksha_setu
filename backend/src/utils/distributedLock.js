import crypto from 'crypto';
import { getRedisClient } from '../config/redis.js';

const RELEASE_LOCK_LUA_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
`;

/**
 * Acquire a distributed lock using Redis (Redlock pattern for single/standalone Redis)
 * @param {string} resourceName - Name of the resource to lock (e.g., 'sos:accept:123')
 * @param {number} ttlMs - Lock Time-To-Live in milliseconds (auto-releases if process dies)
 * @param {number} retryAttempts - Number of retries before giving up
 * @param {number} retryDelayMs - Wait time between retries
 * @returns {Promise<string|null>} - Returns the unique lock token if acquired, or null if failed
 */
export const acquireLock = async (resourceName, ttlMs = 5000, retryAttempts = 3, retryDelayMs = 150) => {
  const lockKey = `lock:${resourceName}`;
  const lockToken = crypto.randomUUID();
  const redis = getRedisClient();

  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    try {
      // SET key token NX PX ttlMs
      const result = await redis.set(lockKey, lockToken, 'PX', ttlMs, 'NX');
      if (result === 'OK') {
        return lockToken;
      }
    } catch (err) {
      console.warn(`[DistributedLock] Error acquiring lock on ${lockKey}:`, err.message);
    }

    if (attempt < retryAttempts) {
      // Jittered backoff to prevent thundering herd
      const jitter = Math.floor(Math.random() * 50);
      await new Promise(resolve => setTimeout(resolve, retryDelayMs + jitter));
    }
  }

  return null;
};

/**
 * Atomically release a distributed lock using Lua script to verify lock ownership
 * @param {string} resourceName
 * @param {string} lockToken
 * @returns {Promise<boolean>}
 */
export const releaseLock = async (resourceName, lockToken) => {
  if (!lockToken) return false;
  const lockKey = `lock:${resourceName}`;
  const redis = getRedisClient();

  try {
    const result = await redis.eval(RELEASE_LOCK_LUA_SCRIPT, 1, lockKey, lockToken);
    return result === 1;
  } catch (err) {
    console.error(`[DistributedLock] Error releasing lock on ${lockKey}:`, err.message);
    return false;
  }
};

/**
 * Execute a critical section guaranteed by a distributed lock
 * @param {string} resourceName
 * @param {number} ttlMs
 * @param {Function} criticalSectionFn
 * @param {Object} options - { retryAttempts: 0 for try-lock, retryDelayMs: 150 }
 */
export const withDistributedLock = async (resourceName, ttlMs = 5000, criticalSectionFn, options = {}) => {
  const { retryAttempts = 0, retryDelayMs = 150 } = options;
  const token = await acquireLock(resourceName, ttlMs, retryAttempts, retryDelayMs);
  if (!token) {
    const error = new Error(`Resource '${resourceName}' is locked by another concurrent process.`);
    error.statusCode = 409;
    error.isLockContention = true;
    throw error;
  }

  try {
    return await criticalSectionFn();
  } finally {
    await releaseLock(resourceName, token);
  }
};
