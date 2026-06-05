import mongoose, { Schema, Types } from "mongoose";

export type UserType = {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  image?: string;
  role: "user" | "admin" | "seller" | "delivery_boy" | "doctor";
  isBlocked: boolean;
  location?: {
    type: "Point";
    coordinates: [number, number];
  };

  refreshToken?: string;
  stripeAccountId?: string;
  hasAgreedToConsultationTerms?: boolean;

  createdAt: Date;
  updatedAt: Date;
};

const userSchema = new Schema<UserType>(
  {
    name: { type: String, required: true },

    email: { type: String, required: true, unique: true },

    phone: { type: String },

    image: { type: String },

    refreshToken: { type: String },

    stripeAccountId: { type: String },

    role: {
      type: String,
      enum: ["user", "admin", "seller", "delivery_boy", "doctor"],
      default: "user",
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },

    hasAgreedToConsultationTerms: {
      type: Boolean,
      default: false,
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
      },
    },
  },
  { timestamps: true }
);

userSchema.index({ location: "2dsphere" });
userSchema.index({ role: 1 });
userSchema.index({ isBlocked: 1 });
userSchema.index({ createdAt: -1 });

export const User = mongoose.model<UserType>("User", userSchema);