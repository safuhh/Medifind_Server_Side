// routes/admin.routes.ts
import { Router } from "express";
import {
  approveseller,
  getSellerRequests,
  rejectSeller
} from "../controllers/admincontroller/admin.controller.js";
import { protect , authorizeRoles} from "../middlewares/auth.middleware.js";

const router = Router();
router.get("/seller-requests", protect, authorizeRoles("admin"), getSellerRequests);
router.put("/approve/:requestId", protect, authorizeRoles("admin"), approveseller);
router.put("/reject/:requestId", protect, authorizeRoles("admin"), rejectSeller);
export default router;
