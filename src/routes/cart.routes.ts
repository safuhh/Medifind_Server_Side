import express from "express";
const router = express.Router();
import { addToCart, increaseQuantity, decreaseQuantity, deleteCart, getCart } from "../controllers/usercontrollers/cart.controller.js";
import { protect, } from "../middlewares/auth.middleware.js";
router.post("/add-to-cart", protect, addToCart);
router.post("/increase-quantity", protect, increaseQuantity);
router.post("/decrease-quantity",protect, decreaseQuantity);
router.post("/delete-cart", protect, deleteCart);
router.post("/get-cart", protect, getCart);
export default router
