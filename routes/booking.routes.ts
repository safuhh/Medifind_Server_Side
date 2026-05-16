import { Router } from "express";
import { bookSlot, confirmPayment } from "../controllers/booking.controller.js";
import { getDoctorAppointments, getPatientAppointments } from "../controllers/appointment.controller.js";
import { getDoctorPatients, getPatientDetails } from "../controllers/patient.controller.js";
import { getSlots } from "../controllers/slot.controller.js";
import { protect, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/get-slots", getSlots);
router.post("/book", protect, bookSlot);
router.get("/doctor-appointments", protect, authorizeRoles("doctor"), getDoctorAppointments);
router.get("/doctor-patients", protect, authorizeRoles("doctor"), getDoctorPatients);
router.get("/patient-details/:patientId", protect, authorizeRoles("doctor"), getPatientDetails);
router.get("/patient-appointments", protect, getPatientAppointments);
router.post("/confirm-payment", protect, confirmPayment);

export default router;
