import express from "express";
const router = express.Router();
import { getConsultation, completeConsultation } from "../controllers/doctorcontroller/consultation.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { verifyConsultationAccess } from "../middlewares/consultation.middleware.js";

router.get("/:roomId", protect, verifyConsultationAccess, getConsultation);
router.post("/:roomId/complete", protect, verifyConsultationAccess, completeConsultation);

export default router;
