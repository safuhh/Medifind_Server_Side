import { Router } from "express";
import { plans } from "../controllers/admincontroller/subscription.controller.js";
import { protect, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

// Retrieve available subscription plans (public or logged in users)
router.get("/plans", plans.getPlans);

// Retrieve current user's subscription status
router.get("/status", protect, plans.getStatus);

// Create checkout session for purchasing a plan
router.post("/checkout", protect, plans.createCheckoutSession);

// Confirm subscription payment and activate Pro status
router.post("/confirm", protect, plans.confirmPayment);

// Admin-only route to retrieve all active subscriptions
router.get("/admin/all", protect, authorizeRoles("admin"), plans.adminGetAllSubscriptions);

export default router;
