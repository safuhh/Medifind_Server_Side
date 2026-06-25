import express from "express";
const router = express.Router();
import {getSellerEarnings} from "../controllers/sellercontroller/seller.earnings.controller.js";
import { protect , authorizeRoles } from "../middlewares/auth.middleware.js";

router.get("/earnings",protect ,authorizeRoles("seller") ,getSellerEarnings);

export default router;
