import mongoose, { Document, Schema, model } from "mongoose";

export interface IConsultation extends Document {
  doctorId: mongoose.Types.ObjectId;

  patientId: mongoose.Types.ObjectId;

  bookingId?: mongoose.Types.ObjectId;

  roomId: string;

  status: "scheduled" | "active" | "completed" | "cancelled";

  scheduledAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

const consultationSchema = new Schema<IConsultation>(
  {
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },

    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "DoctorBooking",
    },

    roomId: {
      type: String,
      required: true,
      unique: true,
    },

    status: {
      type: String,
      enum: ["scheduled", "active", "completed", "cancelled"],
      default: "scheduled",
    },

    scheduledAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export const Consultation = model<IConsultation>(
  "Consultation",
  consultationSchema,
);
