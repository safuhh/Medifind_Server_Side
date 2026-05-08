import express from "express";
const router = express.Router();
import { createconsultaionroom, getConsultation, completeConsultation } from "../controllers/consultation.controller.js";

router.post("/create", createconsultaionroom);
router.get("/:roomId", getConsultation);
router.post("/:roomId/complete", completeConsultation);

export default router;