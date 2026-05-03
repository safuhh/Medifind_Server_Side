import mongoose, { Schema, Types, Document } from "mongoose";

export interface IDeliveryBoy extends Document {
  userId: Types.ObjectId;

  name: string;
  phone: string;

  vehicleType: "bike" | "scooter" | "cycle";
  vehicleNumber: string;

  address: string;

  location: {
    address: string;
    fullAddress: string;
    lat: number;
    lng: number;
  };

  kyc: {
    aadhaarNumber: string;
    aadhaarImage: string;
    isVerified: boolean;
  };

  isOnline: boolean;
  isAvailable: boolean;

  currentOrderId?: Types.ObjectId | null;

  status: "pending" | "approved" | "rejected";

  createdAt: Date;
  updatedAt: Date;
}

const deliveryBoySchema = new Schema<IDeliveryBoy>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    vehicleType: {
      type: String,
      enum: ["bike", "scooter", "cycle"],
      required: true,
    },

    vehicleNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    // 📍 SIMPLE LOCATION (lat/lng)
    location: {
      address: {
        type: String,
        default: "",
      },
      fullAddress: {
        type: String,
        default: "",
      },
      lat: {
        type: Number,
        required: true,
      },
      lng: {
        type: Number,
        required: true,
      },
    },

    // 🪪 KYC
    kyc: {
      aadhaarNumber: {
        type: String,
        required: true,
        trim: true,
      },
      aadhaarImage: {
        type: String,
        required: true,
      },
      isVerified: {
        type: Boolean,
        default: false,
      },
    },

    isOnline: {
      type: Boolean,
      default: false,
    },

    isAvailable: {
      type: Boolean,
      default: true,
    },

    currentOrderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const DeliveryBoy =
  mongoose.models.DeliveryBoy ||
  mongoose.model<IDeliveryBoy>("DeliveryBoy", deliveryBoySchema);