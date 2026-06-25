import express from "express";
import { getLowStocks } from "../controllers/sellercontroller/lowStock.controller.js";
import { protect, authorizeRoles } from "../middlewares/auth.middleware.js";
const router = express.Router();
router.get("/lowstock", protect, authorizeRoles("seller", "admin"), getLowStocks);
export default router;
