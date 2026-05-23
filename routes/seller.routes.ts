// routes/seller.routes.ts
import { Router } from "express";
import {
  applyseller,
  sellerDashboard,
  updateSellerInfo,
  getCurrentSellerInfo
} from "../controllers/sellercontroller/seller.controller.js";
import { protect, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/apply", protect, applyseller);
router.get("/dashboard", protect, authorizeRoles("seller"), sellerDashboard);
router.put("/update", protect, authorizeRoles("seller"), updateSellerInfo);
router.get("/current", protect, getCurrentSellerInfo);
export default router;
