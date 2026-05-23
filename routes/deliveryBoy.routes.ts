import express from "express";
import {
  applyDeliveryBoy,
  updateDeliveryBoyInfo,
  getcurrentDeliveryBoyInfo,
} from "../controllers/deliveryboycontroller/deliveryboy.controller.js";
import { getearnings } from "../controllers/deliveryboycontroller/deliveryboyEarnings.controller.js";

import { protect, authorizeRoles } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

router.post("/apply", protect, upload.single("aadhaarImage"), applyDeliveryBoy);

router.get("/current", protect, getcurrentDeliveryBoyInfo);

router.put(
  "/update",
  protect,
  authorizeRoles("delivery_boy"),
  updateDeliveryBoyInfo
);

router.get(
  "/earnings",
  protect,
  authorizeRoles("delivery_boy"),
  getearnings
);

export default router;