import express from "express";
const router = express.Router();
import { familyChat, getChatHistory, getFamilyHealthSummary } from "../../controllers/aicontrollers/familyChat.controller.js";
import { protect } from "../../middlewares/auth.middleware.js";
import rateLimit from "express-rate-limit";

// Stricter rate limit for AI endpoints (20 req/min)
const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many AI requests. Please wait a moment and try again." },
});

router.post("/chat", protect, aiRateLimit, familyChat);
router.get("/chat/history", protect, getChatHistory);
router.get("/summary", protect, getFamilyHealthSummary);

export default router;
