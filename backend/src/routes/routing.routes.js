import { Router } from 'express';
import { calculateRoute, nearestHospitalsWithRoutes } from '../controllers/routing.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate);
router.get('/route', calculateRoute);
router.get('/nearest-hospitals', nearestHospitalsWithRoutes);

export default router;
