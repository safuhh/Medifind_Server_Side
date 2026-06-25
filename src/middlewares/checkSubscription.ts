import { NextFunction, Response } from "express";
import { AuthRequest } from "../types/authRequest.js";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";

export const checksubcription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "user not found" });
    }

    let subscription = await Subscription.findOne({ userId });

    if (!subscription) {
      subscription = new Subscription({
        userId,
        planType: "FREE",
        trialUsed: 0,
        isPro: false
      });
      await subscription.save();
    }

    if (subscription.isPro) {
      if (subscription.expiryDate && new Date(subscription.expiryDate) < new Date()) {
        subscription.isPro = false;
        await subscription.save();
      } else {
        return next();
      }
    }

    if (user.role === "seller" || user.role === "doctor") {
      if (!subscription.trialStartedAt) {
        subscription.trialStartedAt = new Date();
        await subscription.save();
      } else {
        const diffMs = Date.now() - new Date(subscription.trialStartedAt).getTime();
        const diffSeconds = diffMs / 1000;
        if (diffSeconds >= 20) {
          return res.status(403).json({ message: "trial limit reached" });
        }
      }
    }
    next();
  } catch (error) {
    next(error);
  }
};
