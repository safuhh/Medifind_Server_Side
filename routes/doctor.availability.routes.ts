import { Router } from "express";
import { saveAvailability, getAvailableSlots, getAvailabilityConfig } from "../controllers/doctor.availiblity.controller.js";
import { protect, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/save", protect, authorizeRoles("doctor"), saveAvailability);
router.get("/slots", getAvailableSlots);
router.get("/config", getAvailabilityConfig);

export default router;
