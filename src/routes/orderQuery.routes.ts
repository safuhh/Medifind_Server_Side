import express from "express";
import { getSellerOrders, getUserOrders } from "../controllers/sellercontroller/orderQuery.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/seller-orders", protect, getSellerOrders);
router.get("/my-orders", protect, getUserOrders);

export default router;
