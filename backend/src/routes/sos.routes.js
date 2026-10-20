import express from 'express';
import {
  createSOS,
  acceptSOS,
  resolveSOS,
  rateResponder,
  flagFalseAlert,
  getActiveSOS,
  getPendingSOS,
  getSOSById,
  getMyHistory,
  getPendingWelfareChecks,
  respondToWelfareCheck
} from '../controllers/sos.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware.js';
import { sosRateLimiter } from '../middlewares/rateLimiter.middleware.js';

const router = express.Router();
router.use(authenticate);

// Protected SOS creation with Rate Limiting (Token Bucket) and Redis-backed Idempotency
router.post('/', sosRateLimiter, idempotencyMiddleware, createSOS);
router.patch('/:sosId/accept', acceptSOS);
router.get('/active', getActiveSOS);
router.get('/pending', getPendingSOS);
router.get('/history', getMyHistory);
router.get('/welfare-checks', getPendingWelfareChecks);
router.post('/:sosId/welfare-check', respondToWelfareCheck);
router.get('/:sosId', getSOSById);
router.put('/:sosId/resolve', resolveSOS);
router.post('/:sosId/rate/:responderId', rateResponder);
router.post('/:sosId/flag', flagFalseAlert);

export default router;
