import express from "express";
import { getDoctorsBySpecialization } from "../controllers/doctorcontroller/doctorget.controller.js";
import { protect, authorizeRoles } from "../middlewares/auth.middleware.js";
const router = express.Router();

router.get("/doctorsget", getDoctorsBySpecialization);

export default router;
