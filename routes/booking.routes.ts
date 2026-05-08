import { Router } from "express";
import { getslots, bookslote, getDoctorAppointments, confirmPayment, getPatientAppointments } from "../controllers/booking.controller.js";
import { protect, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/get-slots", getslots);
router.post("/book", protect, bookslote);
router.get("/doctor-appointments", protect, authorizeRoles("doctor"), getDoctorAppointments);
router.get("/patient-appointments", protect, getPatientAppointments);
router.post("/confirm-payment", protect, confirmPayment);

export default router;
