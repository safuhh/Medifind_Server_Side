// routes/location.routes.ts
import { Router } from "express";
import { updatelocation } from "../controllers/location.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/me", protect, updatelocation);

export default router;