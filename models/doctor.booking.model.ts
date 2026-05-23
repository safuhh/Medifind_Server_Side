import mongoose, { Schema, Document } from "mongoose";

export interface IDoctorBooking extends Document {
  doctorId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  date: Date;
  timeSlot: string;
  status: "pending" | "confirmed" | "cancelled";
  paymentStatus: "pending" | "paid" | "failed";
  stripeSessionId?: string;
  amount: number;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DoctorBookingSchema: Schema = new Schema(
  {
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "DoctorApplication",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    timeSlot: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    stripeSessionId: {
      type: String,
    },
    amount: {
        type: Number,
        required: true
    },
    reason: {
        type: String,
    }
  },
  { timestamps: true }
);

export const DoctorBooking = mongoose.model<IDoctorBooking>(
  "DoctorBooking",
  DoctorBookingSchema
);