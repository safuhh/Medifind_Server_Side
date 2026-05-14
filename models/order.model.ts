import mongoose, { Schema, Types, Document } from "mongoose";

export interface IOrderItem {
  medicineId: Types.ObjectId;
  sellerId: Types.ObjectId;
  quantity: number;
  price: number;
  platformFee: number;
  sellerEarning: number;
}

export interface IOrder extends Document {
  userId: Types.ObjectId;
  deliveryDetailsId: Types.ObjectId;
  items: IOrderItem[];
  totalAmount: number;
  deliveryCharge: number;
  platformTotalFee: number;
  sellerTotalEarnings: number;
  deliveryPartnerEarnings: number;
  paymentStatus: "pending" | "paid" | "failed";
  stripeSessionId?: string;
  orderStatus: "pending" | "confirmed" | "picked_up" | "delivered";
  deliveryBoyId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>({
  medicineId: { type: Schema.Types.ObjectId, ref: "Medicine", required: true },
  sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  platformFee: { type: Number, default: 0 },
  sellerEarning: { type: Number, default: 0 },
});

const orderSchema = new Schema<IOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    deliveryDetailsId: { type: Schema.Types.ObjectId, ref: "DeliveryDetails", required: true },
    items: [orderItemSchema],
    totalAmount: { type: Number, required: true },
    deliveryCharge: { type: Number, default: 0 },
    platformTotalFee: { type: Number, default: 0 },
    sellerTotalEarnings: { type: Number, default: 0 },
    deliveryPartnerEarnings: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    stripeSessionId: { type: String },
    orderStatus: {
      type: String,
      enum: ["pending", "confirmed", "picked_up", "delivered"],
      default: "pending",
    },
    deliveryBoyId: { type: Schema.Types.ObjectId, ref: "DeliveryBoy" },
  },
  { timestamps: true }
);

export const Order = mongoose.models.Order || mongoose.model<IOrder>("Order", orderSchema);
