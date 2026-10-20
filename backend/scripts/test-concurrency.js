/**
 * Concurrency and Distributed Lock Verification Script
 * Validates:
 * 1. Mutual exclusion under high-concurrency race conditions (Redlock pattern)
 * 2. Strict Finite State Machine transition assertions
 * 3. Idempotency key deduplication
 *
 * Usage: node scripts/test-concurrency.js
 */

import { withDistributedLock, acquireLock, releaseLock } from '../src/utils/distributedLock.js';
import { isValidSOSTransition, assertValidSOSTransition } from '../src/utils/stateMachine.js';
import { SOS_STATUS } from '../src/constant.js';
import { getRedisClient } from '../src/config/redis.js';

async function runConcurrencyTests() {
  console.log('===========================================================');
  console.log('    RakshaSetu Distributed Lock & State Machine Suite      ');
  console.log('===========================================================');

  const redis = getRedisClient();
  await redis.ping();
  console.log('Redis connected successfully.\n');

  // --- Test 1: Finite State Machine Validation ---
  console.log('[Test 1] Validating Emergency Finite State Machine (FSM)...');
  const validTransitions = [
    [SOS_STATUS.ACTIVE, SOS_STATUS.RESPONDING],
    [SOS_STATUS.ACTIVE, SOS_STATUS.CANCELLED],
    [SOS_STATUS.ACTIVE, SOS_STATUS.RESOLVED],
    [SOS_STATUS.RESPONDING, SOS_STATUS.RESOLVED],
    [SOS_STATUS.RESPONDING, SOS_STATUS.CANCELLED]
  ];

  for (const [from, to] of validTransitions) {
    if (!isValidSOSTransition(from, to)) {
      throw new Error(`FSM failed: ${from} -> ${to} should be valid`);
    }
  }

  const invalidTransitions = [
    [SOS_STATUS.RESOLVED, SOS_STATUS.ACTIVE],
    [SOS_STATUS.CANCELLED, SOS_STATUS.RESPONDING],
    [SOS_STATUS.RESOLVED, SOS_STATUS.RESPONDING]
  ];

  for (const [from, to] of invalidTransitions) {
    if (isValidSOSTransition(from, to)) {
      throw new Error(`FSM failed: ${from} -> ${to} should be invalid`);
    }
  }
  console.log('PASSED: All valid and terminal state transitions enforced.\n');

  // --- Test 2: Distributed Lock Race Condition Simulation ---
  console.log('[Test 2] Simulating 10 concurrent responders accepting the SAME emergency...');
  const emergencyId = 'mock-sos-critical-101';
  const lockKey = `sos:accept:${emergencyId}`;

  let successfulAcquisitions = 0;
  let rejectedAcquisitions = 0;

  // Mock domain entity
  const emergencyEntity = {
    id: emergencyId,
    status: SOS_STATUS.ACTIVE,
    responder: null
  };

  // Fire 10 concurrent requests simultaneously using Promise.all
  const attempts = Array.from({ length: 10 }, async (_, index) => {
    const responderId = `responder-${index + 1}`;
    try {
      await withDistributedLock(lockKey, 2000, async () => {
        // Domain state assertion inside locked critical section
        if (emergencyEntity.status !== SOS_STATUS.ACTIVE) {
          throw new Error('Emergency has already been accepted by another unit.');
        }
        successfulAcquisitions++;
        emergencyEntity.status = SOS_STATUS.RESPONDING;
        emergencyEntity.responder = responderId;
        console.log(`  -> Lock acquired by ${responderId}! Emergency claimed.`);
        await new Promise(resolve => setTimeout(resolve, 40));
      }, { retryAttempts: 0 });
    } catch (err) {
      rejectedAcquisitions++;
    }
  });

  await Promise.all(attempts);

  console.log(`Results:`);
  console.log(`  - Successful Claims:        ${successfulAcquisitions} (Expected: 1)`);
  console.log(`  - Blocked Concurrent Units: ${rejectedAcquisitions} (Expected: 9)`);
  console.log(`  - Winning Responder:        ${emergencyEntity.responder}`);

  if (successfulAcquisitions === 1 && rejectedAcquisitions === 9) {
    console.log('PASSED: Distributed Lock successfully prevented split-brain race condition!\n');
  } else {
    console.error('FAILED: Race condition allowed multiple winners!');
    process.exit(1);
  }

  // --- Test 3: Redis Idempotency Key Guard ---
  console.log('[Test 3] Testing Idempotency Token Ingestion Guard...');
  const testIdempotencyKey = 'idempotency:mockUser:req-uuid-999';
  await redis.del(testIdempotencyKey);

  // First ingestion acquires lock
  const firstAttempt = await redis.set(testIdempotencyKey, 'PROCESSING', 'EX', 60, 'NX');
  // Second ingestion attempts to acquire same key
  const secondAttempt = await redis.set(testIdempotencyKey, 'PROCESSING', 'EX', 60, 'NX');

  if (firstAttempt === 'OK' && secondAttempt === null) {
    console.log('PASSED: Idempotency Key successfully blocked duplicate in-flight network retry.\n');
  } else {
    console.error('FAILED: Duplicate request was not blocked!');
    process.exit(1);
  }

  await redis.del(testIdempotencyKey);
  console.log('===========================================================');
  console.log('   All Distributed Concurrency & FSM Tests Passed (3/3)    ');
  console.log('===========================================================');
  process.exit(0);
}

runConcurrencyTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
