import express from "express";
import {
  createDeliveryDetails,
  getDeliveryDetails,
  updateDeliveryDetails,
  deleteDeliveryDetails,
  getUserDeliveryDetails,
} from "../controllers/DeliveryDetails.controller.js";
import { protect, authorizeRoles } from "../middleware/auth.middleware.js";
const router = express.Router();
router.post("/", protect, createDeliveryDetails);
router.get("/", protect, getDeliveryDetails);
router.put("/:id", protect, updateDeliveryDetails);
router.delete("/:id", protect, deleteDeliveryDetails);
router.get("/:id", getUserDeliveryDetails);
export default router;
