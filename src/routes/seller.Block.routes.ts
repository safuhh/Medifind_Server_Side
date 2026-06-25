import express from "express";
import {
  blockSeller,
  unblockSeller,
  getAllSellers,
} from "../controllers/admincontroller/admin.user.controller.js";
import { protect, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

// o. FIXED PATHS (NO /admin HERE)
router.get("/sellers", protect, authorizeRoles("admin"), getAllSellers);

router.put("/block/:id", protect, authorizeRoles("admin"), blockSeller);

router.put("/unblock/:id", protect, authorizeRoles("admin"), unblockSeller);

export default router;
