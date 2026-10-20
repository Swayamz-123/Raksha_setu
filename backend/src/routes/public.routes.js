import { Router } from 'express';
import { getEmergencyCardByToken } from '../controllers/public.controller.js';

const router = Router();

// Public endpoints (no auth)
router.get('/emergency-card/:token', getEmergencyCardByToken);

export default router;
