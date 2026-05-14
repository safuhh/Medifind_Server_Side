import express from "express";
const router = express.Router();
import {getSellerEarnings} from "../controllers/seller.earnings.controller.js";
import { protect , authorizeRoles } from "../middleware/auth.middleware.js";

router.get("/earnings",protect ,authorizeRoles("seller") ,getSellerEarnings);

export default router;