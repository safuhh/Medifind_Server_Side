import express from "express";
import {
  blockSeller,
  unblockSeller,
  getAllSellers,
} from "../controllers/blockseller.controller.js";
import { protect, authorizeRoles } from "../middleware/auth.middleware.js";

const router = express.Router();

// ✅ FIXED PATHS (NO /admin HERE)
router.get("/sellers", getAllSellers);

router.put("/block/:id", protect, authorizeRoles("admin"), blockSeller);

router.put("/unblock/:id", protect, authorizeRoles("admin"), unblockSeller);

export default router;