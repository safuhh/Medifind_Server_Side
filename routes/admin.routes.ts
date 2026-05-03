// routes/admin.routes.ts
import { Router } from "express";
import {
  approveseller,
  getSellerRequests,
  rejectSeller
} from "../controllers/admin.controller.js";
import { protect , authorizeRoles} from "../middleware/auth.middleware.js";

const router = Router();
router.get("/seller-requests", protect, authorizeRoles("admin"), getSellerRequests);
router.put("/approve/:requestId", protect, authorizeRoles("admin"), approveseller);
router.put("/reject/:requestId", rejectSeller);
export default router;
