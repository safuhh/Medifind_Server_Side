import express from "express";
import {
  applyDeliveryBoy,
  deliveryBoyDashboard,
  updateDeliveryBoyInfo,
  getcurrentDeliveryBoyInfo
} from "../controllers/deliveryboy.controller.js";

import { protect, authorizeRoles } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

router.post("/apply", protect, upload.single("aadhaarImage"), applyDeliveryBoy);

router.get("/current", protect, getcurrentDeliveryBoyInfo);

router.get(
  "/dashboard",
  protect,
  authorizeRoles("delivery_boy"),
  deliveryBoyDashboard
);

router.put(
  "/update",
  protect,
  authorizeRoles("delivery_boy"),
  updateDeliveryBoyInfo
);

export default router;