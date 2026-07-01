import { Request, Response } from "express";
import Stripe from "stripe";
import { User } from "../../models/user.model.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder");

export const createStripeConnectAccount = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // 1. Create a Stripe Standard account for the user
    const account = await stripe.accounts.create({
      type: "standard",
      country: "IN", // Default to India, change if needed
      email: user.email,
    });

    // 2. Create an account link (URL) for the user to complete onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.FRONTEND_URL || "https://medifind-client-side.vercel.app"}/stripe/reauth`,
      return_url: `${process.env.FRONTEND_URL || "https://medifind-client-side.vercel.app"}/stripe/success`,
      type: "account_onboarding",
    });

    // 3. Save the account ID to the user in DB
    user.stripeAccountId = account.id;
    await user.save();

    // Return the URL to the frontend so you can redirect the user
    return res.json({ success: true, url: accountLink.url });
  } catch (error: any) {
    console.error("Error creating Connect account:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
