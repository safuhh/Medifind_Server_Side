import express from "express";
import {
  rejectDeliveryBoy,
  approveDeliveryBoy,
   getDeliveryBoyRequests, 
} from "../controllers/admincontroller/deliveryadmin.controller.js";

import { protect, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.put(
  "/approve/:requestId",
  protect,
  authorizeRoles("admin"),
  approveDeliveryBoy
);

router.put(
  "/reject/:requestId",
  protect,
  authorizeRoles("admin"),
  rejectDeliveryBoy
);
router.get(
  "/requests",
  protect,
  authorizeRoles("admin"),
  getDeliveryBoyRequests
);

export default router;
