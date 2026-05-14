import express from "express";
import { createHealthReport, getHealthReportByBooking } from "../controllers/healthReport.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.post("/", createHealthReport);
router.get("/booking/:bookingId", getHealthReportByBooking);

export default router;
