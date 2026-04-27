// routes/admin.routes.ts
import { Router } from "express";
import {
  approveseller,
  getSellerRequests,
} from "../controllers/admin.controller.js";
import { protect} from "../middleware/auth.middleware.js";

const router = Router();

router.put(
  "/approve/:requestId",
  protect,

  approveseller,
);
router.get(
  "/seller-requests",
  protect,

  
  getSellerRequests,
  
);

export default router;
