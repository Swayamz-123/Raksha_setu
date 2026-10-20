import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../config/redis.js';

export const SOS_DISPATCH_QUEUE_NAME = 'sos-dispatch';

let sosDispatchQueue = null;

export const getSOSDispatchQueue = () => {
  if (!sosDispatchQueue) {
    sosDispatchQueue = new Queue(SOS_DISPATCH_QUEUE_NAME, {
      connection: redisConnectionOptions,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: {
          count: 500, // Keep last 500 completed jobs for telemetry/audit
          age: 3600   // 1 hour
        },
        removeOnFail: {
          count: 200,
          age: 86400  // 24 hours
        }
      }
    });

    sosDispatchQueue.on('error', (err) => {
      console.error('[BullMQ SOS Queue] Error:', err.message);
    });
  }
  return sosDispatchQueue;
};

/**
 * Enqueue an emergency SOS for asynchronous dispatch and AI enrichment
 * @param {Object} payload 
 * @returns {Promise<Job>}
 */
export const enqueueSOSDispatch = async (payload) => {
  const queue = getSOSDispatchQueue();
  const job = await queue.add('dispatch-and-enrich', payload, {
    jobId: `sos-${payload.sosId}` // Enforce idempotency on queue level
  });
  console.log(`[BullMQ] Enqueued SOS dispatch job: ${job.id} for SOS: ${payload.sosId}`);
  return job;
};
