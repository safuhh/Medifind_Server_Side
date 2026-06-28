import mongoose, { Schema, Document, Types } from "mongoose";

export interface SearchHistoryType extends Document {
  userId: Types.ObjectId;
  medicineName: string;
  genericName?: string;
  brandName?: string;
  medicineDescription?: string;
  dosageInformation?: string;
  usageInstructions?: string;
  sideEffects?: string;
  warningsPrecautions?: string;
  alternativeMedicines: string[];
  nearbyPharmacyResults: {
    name: string;
    address: string;
    distance: number | null;
  }[];
  searchLocation: string;
  availablePharmaciesFound: number;
  searchResultStatus: "available" | "unavailable" | "low_stock";
  medicineCategory?: string;
  searchQuery: string;
  isFavorite: boolean;
  timestamp: Date;
}

const searchHistorySchema = new Schema<SearchHistoryType>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    medicineName: { type: String, required: true, trim: true },
    genericName: { type: String, trim: true },
    brandName: { type: String, trim: true },
    medicineDescription: { type: String },
    dosageInformation: { type: String },
    usageInstructions: { type: String },
    sideEffects: { type: String },
    warningsPrecautions: { type: String },
    alternativeMedicines: [{ type: String }],
    nearbyPharmacyResults: [
      {
        name: { type: String },
        address: { type: String },
        distance: { type: Number },
      },
    ],
    searchLocation: { type: String, default: "Global" },
    availablePharmaciesFound: { type: Number, default: 0 },
    searchResultStatus: {
      type: String,
      enum: ["available", "unavailable", "low_stock"],
      default: "available",
    },
    medicineCategory: { type: String },
    searchQuery: { type: String, required: true, trim: true },
    isFavorite: { type: Boolean, default: false, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

searchHistorySchema.index({ timestamp: -1 });

export const SearchHistory = mongoose.models.SearchHistory || mongoose.model<SearchHistoryType>("SearchHistory", searchHistorySchema);
