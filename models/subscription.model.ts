import mongoose, { Schema, Types } from "mongoose";

export interface SubscriptionType {
  userId: Types.ObjectId;
  planType: string;
  isPro: boolean;
  expiryDate?: Date;
  trialStartedAt?: Date;
  trialUsed: number;
}

const subscriptionSchema = new Schema<SubscriptionType>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    planType: { type: String, default: "FREE" },
    isPro: { type: Boolean, default: false },
    expiryDate: { type: Date },
    trialStartedAt: { type: Date },
    trialUsed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Subscription = mongoose.model<SubscriptionType>(
  "Subscription",
  subscriptionSchema
);
