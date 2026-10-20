import { Router } from "express";
import {
    fetchNearbyHospitals,
    getNearbyFromDB,
    getAllFromDB,
    addHospital,
    updateHospital,
    deleteHospital,
    seedHospitalsFromOSM
} from "../controllers/hospital.controllers.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { USER_ROLES } from "../constant.js";

const router = Router();

// Public — no auth needed (uses OpenStreetMap live)
router.get("/nearby", fetchNearbyHospitals);

// DB routes — auth required
router.get("/db/nearby", authenticate, getNearbyFromDB);
router.get("/db", authenticate, getAllFromDB);
router.post("/db", authenticate, addHospital);
router.put("/db/:id", authenticate, updateHospital);
router.delete("/db/:id", authenticate, authorize(USER_ROLES.ADMIN), deleteHospital);
router.post("/db/seed", authenticate, seedHospitalsFromOSM);

export default router;
