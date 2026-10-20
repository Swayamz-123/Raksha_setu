import express from 'express';
import { register, login, logout, getProfile, updateProfile, addGuardian, removeGuardian, getGuardians, getWards, getEmergencyCardToken } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authLoginRateLimiter } from '../middlewares/rateLimiter.middleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', authLoginRateLimiter, login);
router.post('/logout', authenticate, logout);
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.get('/guardians', authenticate, getGuardians);
router.post('/guardians', authenticate, addGuardian);
router.delete('/guardians/:guardianId', authenticate, removeGuardian);
router.get('/wards', authenticate, getWards);
router.get('/emergency-card-token', authenticate, getEmergencyCardToken);

export default router;
