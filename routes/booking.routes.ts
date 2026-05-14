import { Router } from "express";
import { getSlots, bookSlot, getDoctorAppointments, confirmPayment, getPatientAppointments } from "../controllers/booking.controller.js";
import { protect, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/get-slots", getSlots);
router.post("/book", protect, bookSlot);
router.get("/doctor-appointments", protect, authorizeRoles("doctor"), getDoctorAppointments);
router.get("/patient-appointments", protect, getPatientAppointments);
router.post("/confirm-payment", protect, confirmPayment);

export default router;
