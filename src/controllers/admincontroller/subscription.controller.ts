import { User } from "../../models/user.model.js";
import { Subscription } from "../../models/subscription.model.js";
import { SubscriptionPayment } from "../../models/subscriptionPayment.model.js";
import { Request, Response } from "express";
import Stripe from "stripe";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "sk_test_placeholder",
);

const SUBSCRIPTION_PLANS = [
  {
    id: "PRO_MONTHLY",
    name: "Pro Monthly",
    price: 999,
    durationMonths: 1,
    description:
      "Get full access to all seller/doctor features on a monthly basis.",
  },
  {
    id: "PRO_YEARLY",
    name: "Pro Yearly",
    price: 9999,
    durationMonths: 12,
    description:
      "Get full access to all seller/doctor features on a yearly basis (Save 16%).",
  },
];

export const plans = {
  // 1. Get available subscription plans
  getPlans: async (req: Request, res: Response) => {
    try {
      return res.status(200).json({ success: true, plans: SUBSCRIPTION_PLANS });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to retrieve plans",
      });
    }
  },

  // 2. Create a Stripe Checkout session for subscription
  createCheckoutSession: async (req: Request, res: Response) => {
    try {
      const { planId } = req.body;
      const user = (req as any).user;
      const userId = user?.id;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
      if (!plan) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid plan selected" });
      }

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const lineItems = [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: plan.name,
              description: plan.description,
            },
            unit_amount: Math.round(plan.price * 100),
          },
          quantity: 1,
        },
      ];

      let session;
      try {
        session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: lineItems,
          mode: "payment",
          success_url: `http://localhost:3000/stripe/success?session_id={CHECKOUT_SESSION_ID}&type=subscription&plan_id=${plan.id}`,
          cancel_url:
            user.role === "seller"
              ? `http://localhost:3000/seller/add-medicine`
              : user.role === "doctor"
                ? `http://localhost:3000/doctor/availability`
                : `http://localhost:3000/subcription`,
          metadata: {
            userId: userId.toString(),
            planId: plan.id,
            durationMonths: plan.durationMonths.toString(),
          },
        });
      } catch (stripeError: any) {
        console.error(
          "STRIPE SUBSCRIPTION SESSION ERROR:",
          stripeError.message,
        );
        if (
          !process.env.STRIPE_SECRET_KEY ||
          process.env.STRIPE_SECRET_KEY === "sk_test_placeholder"
        ) {
          session = {
            id: "mock_sub_session_" + Date.now(),
            url: `${frontendUrl}/stripe/success?session_id=mock_sub_session_${Date.now()}&type=subscription&plan_id=${plan.id}`,
          };
        } else {
          throw stripeError;
        }
      }

      return res.status(200).json({ success: true, url: session.url });
    } catch (error: any) {
      console.error("Subscription Checkout Session Error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  },

  // 3. Confirm subscription payment and activate Pro status
  confirmPayment: async (req: Request, res: Response) => {
    try {
      const { sessionId, planId } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      if (!sessionId) {
        return res
          .status(400)
          .json({ success: false, message: "Session ID is required" });
      }

      let activePlanId = planId;
      let durationMonths = 1;

      if (!sessionId.startsWith("mock_sub_session_")) {
        try {
          const session = await stripe.checkout.sessions.retrieve(sessionId);
          if (session.payment_status !== "paid") {
            return res.status(400).json({
              success: false,
              message:
                "Payment is not completed. Stripe status: " +
                session.payment_status,
            });
          }
          activePlanId = session.metadata?.planId || planId;
          durationMonths = parseInt(
            session.metadata?.durationMonths || "1",
            10,
          );
        } catch (stripeError: any) {
          console.error("Stripe Session Retrieval Error:", stripeError);
          return res.status(400).json({
            success: false,
            message: "Failed to verify payment status with Stripe.",
          });
        }
      } else {
        const plan = SUBSCRIPTION_PLANS.find((p) => p.id === activePlanId);
        if (plan) {
          durationMonths = plan.durationMonths;
        }
      }

      const user = await User.findById(userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + durationMonths);

      let subscription = await Subscription.findOne({ userId });
      if (!subscription) {
        subscription = new Subscription({
          userId,
          planType: activePlanId || "PRO_MONTHLY",
          isPro: true,
          expiryDate,
          trialUsed: 0,
        });
      } else {
        subscription.planType = activePlanId || "PRO_MONTHLY";
        subscription.isPro = true;
        subscription.expiryDate = expiryDate;
      }

      await subscription.save();

      // Check if this session already has a payment record to avoid duplicates
      const existingPayment = await SubscriptionPayment.findOne({
        stripeSessionId: sessionId,
      });
      if (!existingPayment) {
        const amountPaid = activePlanId === "PRO_YEARLY" ? 9999 : 999;
        const subPayment = new SubscriptionPayment({
          userId: user._id,
          role: user.role,
          planId: activePlanId || "PRO_MONTHLY",
          amountPaid,
          stripeSessionId: sessionId,
        });
        await subPayment.save();
      }

      return res.status(200).json({
        success: true,
        message: `Subscription activated successfully. Expires on ${expiryDate.toLocaleDateString()}`,
        subscription,
      });
    } catch (error: any) {
      console.error("Confirm Subscription Error:", error);
      require("fs").appendFileSync(
        "error.log",
        new Date().toISOString() + " " + (error.stack || error.message) + "\n",
      );
      return res.status(500).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  },

  // 4. Retrieve current user's subscription details
  getStatus: async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const user = await User.findById(userId).select("role");
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      let subscription = await Subscription.findOne({ userId });
      if (!subscription) {
        subscription = new Subscription({
          userId,
          planType: "FREE",
          trialUsed: 0,
          isPro: false,
        });
        await subscription.save();
      }

      if (subscription.isPro && subscription.expiryDate && new Date(subscription.expiryDate) < new Date()) {
        subscription.isPro = false;
        await subscription.save();
      }

      return res.status(200).json({
        success: true,
        subscription,
        role: user.role,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  },

  // 5. Get all subscriptions (Admin view)
  adminGetAllSubscriptions: async (req: Request, res: Response) => {
    try {
      const subscriptions = await Subscription.find({ isPro: true }).populate(
        "userId",
        "name email role",
      );
      return res.status(200).json({ success: true, subscriptions });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Internal server error",
      });
    }
  },
};
