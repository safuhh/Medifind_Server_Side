import mongoose, { Schema, Document } from "mongoose";

export interface MedicineType extends Document {
  name: string;
  genericName?: string;
  brand: string;

  description?: string;
  category: string;
  unitWeight?: string;

  composition: {
    salt: string;
    strength: string;
  }[];

  manufacturer: string;

  isPrescriptionRequired: boolean;

  pricing: {
    mrp: number;
    sellingPrice: number;
    discount?: number;
    offer?: string; // New field
    gst?: number;
  };

  stock: number; // Simplified top-level stock
  inventory?: {
    stock: number;
    batchNumber: string;
    expiryDate: Date;
    manufacturingDate?: Date;
  }[];

  images?: string[];

  sellerId: mongoose.Types.ObjectId;

  isActive: boolean;
  barcode?: string;
}

const medicineSchema = new Schema<MedicineType>(
  {
    name: { type: String, required: true, trim: true },
    genericName: { type: String },

    brand: { type: String, required: true },

    description: { type: String },

    category: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    unitWeight: { type: String, trim: true },
    composition: [
      {
        salt: { type: String, required: true },
        strength: { type: String, required: true },
      },
    ],

    manufacturer: { type: String, required: true },

    isPrescriptionRequired: { type: Boolean, default: false },

    pricing: {
      mrp: { type: Number, required: true },
      sellingPrice: { type: Number, required: true },
      discount: { type: Number, default: 0 },
      offer: { type: String }, // New field
      gst: { type: Number, default: 0 },
    },

    stock: { type: Number, default: 0 }, // Simplified top-level stock

    inventory: [
      {
        stock: { type: Number },
        batchNumber: { type: String },
        expiryDate: { type: Date },
        manufacturingDate: { type: Date },
      },
    ],

    images: [{ type: String }],

    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    isActive: { type: Boolean, default: true },
    barcode: { type: String, index: true },
  },
  { timestamps: true },
);

// Indexes for search performance
medicineSchema.index({ name: 1 });
medicineSchema.index({ brand: 1 });
medicineSchema.index({ category: 1 });
medicineSchema.index({ manufacturer: 1 });
medicineSchema.index({ isActive: 1 });
medicineSchema.index({ name: "text", brand: "text", category: "text", manufacturer: "text" });
medicineSchema.index({ createdAt: -1 });

export const Medicine = mongoose.models.Medicine || mongoose.model<MedicineType>(
  "Medicine",
  medicineSchema,
);
