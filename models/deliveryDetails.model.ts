import mongoose from "mongoose";

const deliveryDetailsSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    address: { type: String, required: true, trim: true },

    landmark: { type: String, trim: true },

    city: { type: String, required: true, trim: true },

    state: { type: String, required: true, trim: true },

    zip: { type: String, required: true, trim: true },

    country: { type: String, required: true, trim: true },

    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{10,15}$/, "Invalid phone number"],
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

deliveryDetailsSchema.index({ userId: 1 });
deliveryDetailsSchema.index({ userId: 1, createdAt: -1 });
deliveryDetailsSchema.index({ city: 1, state: 1 });
const DeliveryDetails = mongoose.model(
  "DeliveryDetails",
  deliveryDetailsSchema,
);

export default DeliveryDetails;
