import express from "express";
import {
  getAllDeliveryBoys,
  blockDeliveryBoy,
  unblockDeliveryBoy,
  updateDeliveryBoy,
} from "../controllers/blockdeliveryboy.controller.js";
import { protect, authorizeRoles } from "../middleware/auth.middleware.js";

const router = express.Router();

// All routes require admin role
router.use(protect);
router.use(authorizeRoles("admin"));

router.get("/all", getAllDeliveryBoys);
router.put("/block/:id", blockDeliveryBoy);
router.put("/unblock/:id", unblockDeliveryBoy);
router.put("/update/:id", updateDeliveryBoy);

export default router;
