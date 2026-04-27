import { Router } from "express";
import {
  googleAuth,
  refreshToken,
  getCurrentUser,
  logout,
  getAllUsers,
} from "../controllers/auth.controller.js";

import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/google", googleAuth);
router.post("/refresh", refreshToken);
router.get("/current", protect, getCurrentUser);
router.post("/logout", logout);
router.get("/users", getAllUsers);

export default router;