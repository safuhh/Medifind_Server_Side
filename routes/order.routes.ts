import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { checkoutCart, confirmOrderPayment } from "../controllers/order.controller.js";

const router = express.Router();

router.post("/checkout", protect, checkoutCart);
router.post("/confirm-payment", protect, confirmOrderPayment);

export default router;
