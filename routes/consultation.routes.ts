import express from "express";
const router = express.Router();
import { getConsultation, completeConsultation } from "../controllers/consultation.controller.js";

router.get("/:roomId", getConsultation);
router.post("/:roomId/complete", completeConsultation);

export default router;