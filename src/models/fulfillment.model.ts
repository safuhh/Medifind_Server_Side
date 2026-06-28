import { Schema, model, Document, Types } from "mongoose";

interface IFulfillmentSplitItem {
  name: string;
  genericName: string;
  price: number;
  quantity: number;
}

interface IFulfillmentSplit {
  pharmacyId: Types.ObjectId;
  pharmacyName: string;
  pharmacyPhone?: string;
  pharmacyEmail?: string;
  pharmacyCoordinates?: [number, number];
  distance?: number;
  medicines: IFulfillmentSplitItem[];
  subtotal: number;
}

export interface IFulfillment extends Document {
  prescriptionId: string;
  patientId: string;
  familyMemberId?: string;
  originalMedicines: string[];
  splits: IFulfillmentSplit[];
  unavailableMedicines?: string[];
  totalAmount: number;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  createdAt: Date;
}

const FulfillmentSchema = new Schema<IFulfillment>({
  prescriptionId: {
    type: String,
    required: true,
    index: true,
  },
  patientId: {
    type: String,
    required: true,
    index: true,
  },
  familyMemberId: {
    type: String,
    index: true,
  },
  originalMedicines: [{
    type: String,
    required: true,
  }],
  unavailableMedicines: [{
    type: String,
  }],
  splits: [{
    pharmacyId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    pharmacyName: {
      type: String,
      required: true,
    },
    pharmacyPhone: { type: String },
    pharmacyEmail: { type: String },
    pharmacyCoordinates: { type: [Number] },
    distance: { type: Number },
    medicines: [{
      name: { type: String, required: true },
      genericName: { type: String, required: true },
      price: { type: Number, required: true },
      quantity: { type: Number, required: true, default: 1 },
    }],
    subtotal: {
      type: Number,
      required: true,
    },
  }],
  totalAmount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "confirmed", "completed", "cancelled"],
    default: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Fulfillment = model<IFulfillment>("Fulfillment", FulfillmentSchema);
