import { Router } from "express";
import {
  googleAuth,
  refreshToken,
  getCurrentUser,
  updateConsultationConsent,
  logout,
  getAllUsers,
} from "../controllers/auth.controller.js";

import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/google", googleAuth);
router.post("/refresh", refreshToken);
router.get("/current", protect, getCurrentUser);
router.put("/consent", protect, updateConsultationConsent);
router.post("/logout", logout);
router.get("/users", getAllUsers);

export default router;