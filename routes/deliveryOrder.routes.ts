import express from "express";
import {
  deliveryBoyDashboard,
  getAvailableOrders,
  acceptOrder,
  pickupOrder,
  deliverOrder
} from "../controllers/deliveryboycontroller/deliveryOrder.controller.js";
import { protect, authorizeRoles } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get(
  "/dashboard",
  protect,
  authorizeRoles("delivery_boy"),
  deliveryBoyDashboard
);

router.get(
  "/available-orders",
  protect,
  authorizeRoles("delivery_boy"),
  getAvailableOrders
);

router.post(
  "/accept-order",
  protect,
  authorizeRoles("delivery_boy"),
  acceptOrder
);

router.post(
  "/pickup-order",
  protect,
  authorizeRoles("delivery_boy"),
  pickupOrder
);

router.post(
  "/deliver-order",
  protect,
  authorizeRoles("delivery_boy"),
  deliverOrder
);

export default router;
