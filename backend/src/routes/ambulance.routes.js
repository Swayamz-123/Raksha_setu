import { Router } from 'express';
import {
  addAmbulance,
  getAllAmbulances,
  getNearbyAmbulances,
  updateAmbulance,
  updateAmbulanceStatus,
  deleteAmbulance,
  seedAmbulances
} from '../controllers/ambulance.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { USER_ROLES } from '../constant.js';

const router = Router();
router.use(authenticate);

router.get('/', getAllAmbulances);
router.get('/nearby', getNearbyAmbulances);
router.post('/seed', authorize(USER_ROLES.ADMIN), seedAmbulances);
router.post('/', authorize(USER_ROLES.ADMIN), addAmbulance);
router.put('/:id', authorize(USER_ROLES.ADMIN), updateAmbulance);
router.put('/:id/status', updateAmbulanceStatus);
router.delete('/:id', authorize(USER_ROLES.ADMIN), deleteAmbulance);

export default router;
