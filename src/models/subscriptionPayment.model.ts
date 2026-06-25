import mongoose, { Schema, Types } from "mongoose";

export type SubscriptionPaymentType = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  role: string;
  planId: string;
  amountPaid: number;
  stripeSessionId: string;
  createdAt: Date;
  updatedAt: Date;
};

const subscriptionPaymentSchema = new Schema<SubscriptionPaymentType>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, required: true },
    planId: { type: String, required: true },
    amountPaid: { type: Number, required: true },
    stripeSessionId: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

subscriptionPaymentSchema.index({ role: 1 });
subscriptionPaymentSchema.index({ createdAt: -1 });

export const SubscriptionPayment = mongoose.model<SubscriptionPaymentType>(
  "SubscriptionPayment",
  subscriptionPaymentSchema
);
