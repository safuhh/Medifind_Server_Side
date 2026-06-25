import express from "express";
import { createHealthReport, getHealthReportByBooking } from "../controllers/doctorcontroller/healthReport.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.post("/", createHealthReport);
router.get("/booking/:bookingId", getHealthReportByBooking);

export default router;
