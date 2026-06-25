import mongoose, { Schema, Document } from "mongoose";

export interface IDoctorReview extends Document {
  doctorId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  bookingId?: mongoose.Types.ObjectId;
  rating: number;
  reviewText?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DoctorReviewSchema = new Schema<IDoctorReview>(
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
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "DoctorBooking",
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    reviewText: {
      type: String,
    },
  },
  { timestamps: true }
);

export const DoctorReview = mongoose.model<IDoctorReview>(
  "DoctorReview",
  DoctorReviewSchema
);
