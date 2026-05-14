import { Router } from "express";
import { getCommissions } from "../controllers/commissions.controller.js";
import { protect, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", protect, authorizeRoles("admin"), getCommissions);

export default router;
