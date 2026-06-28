import mongoose, { Schema, Types, Document } from "mongoose";

export interface IOrderItem {
  medicineId: Types.ObjectId;
  sellerId: Types.ObjectId;
  quantity: number;
  price: number;
  platformFee: number;
  sellerEarning: number;
  isPickedUp: boolean;
}

export interface IOrder extends Document {
  userId: Types.ObjectId;
  familyMemberId?: Types.ObjectId;
  deliveryDetailsId: Types.ObjectId;
  items: IOrderItem[];
  totalAmount: number;
  deliveryCharge: number;
  platformTotalFee: number;
  sellerTotalEarnings: number;
  deliveryPartnerEarnings: number;
  paymentStatus: "pending" | "paid" | "failed";
  stripeSessionId?: string;
  splitFulfillmentId?: string;
  orderStatus: "pending" | "confirmed" | "picked_up" | "delivered";
  statusHistory: {
    status: "pending" | "confirmed" | "picked_up" | "delivered";
    timestamp: Date;
  }[];
  deliveryBoyId?: Types.ObjectId;
  isBuyNow?: boolean;
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
  isPickedUp: { type: Boolean, default: false },
});

const orderSchema = new Schema<IOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    familyMemberId: { type: Schema.Types.ObjectId, ref: "FamilyMember" },
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
    splitFulfillmentId: { type: String },
    orderStatus: {
      type: String,
      enum: ["pending", "confirmed", "picked_up", "delivered"],
      default: "pending",
    },
    statusHistory: [
      {
        status: { type: String, enum: ["pending", "confirmed", "picked_up", "delivered"] },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    deliveryBoyId: { type: Schema.Types.ObjectId, ref: "DeliveryBoy" },
    isBuyNow: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Order: mongoose.Model<IOrder> = mongoose.models.Order || mongoose.model<IOrder>("Order", orderSchema);
