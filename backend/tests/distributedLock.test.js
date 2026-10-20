import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { acquireLock, releaseLock, withDistributedLock } from '../src/utils/distributedLock.js';
import { getRedisClient } from '../src/config/redis.js';

describe('Redis Distributed Lock (Redlock Pattern)', () => {
  let redis;

  beforeAll(async () => {
    redis = getRedisClient();
    await redis.ping();
  });

  afterAll(async () => {
    await redis.del('lock:test-resource-1', 'lock:test-resource-2', 'lock:test-resource-3');
    await redis.quit();
  });

  it('acquires and releases a lock atomically', async () => {
    const resource = 'test-resource-1';
    const token = await acquireLock(resource, 2000);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    // Second acquire should fail because lock is held
    const secondToken = await acquireLock(resource, 2000, 0);
    expect(secondToken).toBeNull();

    // Release with matching token
    const released = await releaseLock(resource, token);
    expect(released).toBe(true);

    // After release, acquiring should succeed again
    const thirdToken = await acquireLock(resource, 2000);
    expect(thirdToken).toBeDefined();
    await releaseLock(resource, thirdToken);
  });

  it('does not release lock if token does not match', async () => {
    const resource = 'test-resource-2';
    const token = await acquireLock(resource, 2000);
    expect(token).toBeDefined();

    // Attempt release with fake token
    const releasedFake = await releaseLock(resource, 'wrong-random-token');
    expect(releasedFake).toBe(false);

    // Clean up
    await releaseLock(resource, token);
  });

  it('executes critical section with withDistributedLock', async () => {
    const resource = 'test-resource-3';
    let executed = false;

    const result = await withDistributedLock(resource, 2000, async () => {
      executed = true;
      return 'SUCCESS_PAYLOAD';
    });

    expect(executed).toBe(true);
    expect(result).toBe('SUCCESS_PAYLOAD');

    // Verify lock is auto-released
    const tokenAfter = await acquireLock(resource, 1000);
    expect(tokenAfter).toBeDefined();
    await releaseLock(resource, tokenAfter);
  });
});
