import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { checkoutCart, confirmOrderPayment, getOptimizedSplits, planFulfillmentPrescription } from "../controllers/usercontrollers/order.controller.js";

const router = express.Router();

router.post("/checkout", protect, checkoutCart);
router.post("/confirm-payment", protect, confirmOrderPayment);
router.post("/optimize-split", protect, getOptimizedSplits);
router.post("/planner", protect, planFulfillmentPrescription);

export default router;
