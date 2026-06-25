import { Router } from "express";
import { getCommissions } from "../controllers/admincontroller/commissions.controller.js";
import { protect, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", protect, authorizeRoles("admin"), getCommissions);

export default router;
