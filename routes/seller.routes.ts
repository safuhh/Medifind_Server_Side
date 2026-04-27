// routes/seller.routes.ts
import { Router } from "express";
import { applyseller } from "../controllers/seller.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/apply", protect, applyseller);

export default router;