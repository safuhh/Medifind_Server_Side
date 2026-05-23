import { Router } from "express";
import { createStripeConnectAccount } from "../controllers/usercontrollers/stripe.controller.js";
import { protect, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/connect", protect, authorizeRoles("seller", "delivery_boy"), createStripeConnectAccount);

export default router;
