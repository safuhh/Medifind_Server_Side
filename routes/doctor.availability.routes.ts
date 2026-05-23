import { Router } from "express";
import { saveAvailability, getAvailableSlots, getAvailabilityConfig } from "../controllers/doctorcontroller/doctor.availiblity.controller.js";
import { protect, authorizeRoles } from "../middleware/auth.middleware.js";
import { checksubcription } from "../middleware/checkSubscription.js";

const router = Router();

router.post("/save", protect, authorizeRoles("doctor"), checksubcription, saveAvailability);
router.get("/slots", getAvailableSlots);
router.get("/config", getAvailabilityConfig);

export default router;
