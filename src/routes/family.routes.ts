import express from "express";
const router = express.Router();
import {
  getFamilyMembers,
  addFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  getFamilyMemberHealthReports,
  getFamilyMemberBookings,
  getFamilyMemberOrders,
  verifyFamilyMember,
  resendFamilyMemberOTP,
} from "../controllers/usercontrollers/family.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

router.get("/", protect, getFamilyMembers);
router.post("/", protect, addFamilyMember);
router.post("/:id/verify", protect, verifyFamilyMember);
router.post("/:id/resend-otp", protect, resendFamilyMemberOTP);
router.patch("/:id", protect, updateFamilyMember);
router.delete("/:id", protect, deleteFamilyMember);
router.get("/:id/health-reports", protect, getFamilyMemberHealthReports);
router.get("/:id/bookings", protect, getFamilyMemberBookings);
router.get("/:id/orders", protect, getFamilyMemberOrders);

export default router;
