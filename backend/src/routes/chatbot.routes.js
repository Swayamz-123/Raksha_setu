import express from 'express';
import { chat } from '../controllers/chatbot.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { aiChatRateLimiter } from '../middlewares/rateLimiter.middleware.js';

const router = express.Router();
router.use(authenticate);
router.post('/chat', aiChatRateLimiter, chat);

export default router;
