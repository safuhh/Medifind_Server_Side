import { Router } from "express";
import {
  googleAuth,
  refreshToken,
  getCurrentUser,
  updateConsultationConsent,
  logout,
  getAllUsers,
} from "../controllers/usercontrollers/auth.controller.js";

import { protect, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/google", googleAuth);
router.post("/refresh", refreshToken);
router.get("/current", protect, getCurrentUser);
router.put("/consent", protect, updateConsultationConsent);
router.post("/logout", logout);
router.get("/users", protect, authorizeRoles("admin"), getAllUsers);

export default router;