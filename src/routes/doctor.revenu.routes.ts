import express from "express";
import {
  todayEarnings,
  monthlyEarnings,
  earlyearnings,
} from "../controllers/doctorcontroller/doctor.revenue.controller.js";
import {protect,authorizeRoles} from "../middlewares/auth.middleware.js";
const router = express.Router();
router.use(protect, authorizeRoles("doctor"));
router.get("/today", todayEarnings);
router.get("/monthly", monthlyEarnings);
router.get("/early", earlyearnings);
export default router;
