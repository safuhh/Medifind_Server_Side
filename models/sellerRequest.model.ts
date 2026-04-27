import mongoose, { Schema, Types } from "mongoose";

export type SellerRequestType = {
  userId: Types.ObjectId;
  shopName: string;
  licenseNumber: string;
  address: string;
  phone: string;
  status: "pending" | "approved" | "rejected";
};
const sellerRequestSchema = new Schema<SellerRequestType>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    shopName: { type: String, required: true },
    licenseNumber: { type: String, required: true },
    address: { type: String, required: true },
    phone: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true },
);
export const SellerRequest = mongoose.model<SellerRequestType>(
  "SellerRequest",
  sellerRequestSchema,
);
