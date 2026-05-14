import mongoose, { Schema, Document, Types } from "mongoose";

export interface IHealthReport extends Document {
  bookingId: Types.ObjectId;
  doctorId: Types.ObjectId;
  patientId: Types.ObjectId;
  notes: string;
  medicines: Array<{
    medicineId: Types.ObjectId;
    name: string;
    dosage: string;
    instructions: string;
    quantity: number;
    timesPerDay: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const HealthReportSchema = new Schema<IHealthReport>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: "DoctorBooking", required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: "DoctorApplication", required: true },
    patientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    notes: { type: String, required: true },
    medicines: [
      {
        medicineId: { type: Schema.Types.ObjectId, ref: "Medicine", required: true },
        name: { type: String, required: true },
        dosage: { type: String, required: true }, 
        instructions: { type: String, required: true }, 
        timesPerDay: { type: String },
        quantity: { type: Number, default: 1 },
      },
    ],
  },
  { timestamps: true }
);

export const HealthReport = mongoose.model<IHealthReport>(
  "HealthReport",
  HealthReportSchema
);
