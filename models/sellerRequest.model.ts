import mongoose, { Schema, Types, Document } from "mongoose";

export interface ISellerRequest extends Document {
  userId: Types.ObjectId;
  shopName: string;
  licenseNumber: string;
  address: string;
  phone: string;

  location: {
    address: string;        
    fullAddress: string;    
    lat: number | null;
    lng: number | null;
  };

  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  updatedAt: Date;
}

const sellerRequestSchema = new Schema<ISellerRequest>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
      index: true,
    },

    shopName: {
      type: String,
      required: true,
      trim: true,
    },

    licenseNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

  
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
        default: null,
      },
      lng: {
        type: Number,
        default: null,
      },
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

sellerRequestSchema.index({ "location.lat": 1, "location.lng": 1 });

export const SellerRequest =
  mongoose.models.SellerRequest ||
  mongoose.model<ISellerRequest>("SellerRequest", sellerRequestSchema);