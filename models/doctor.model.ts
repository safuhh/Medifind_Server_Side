import mongoose, { Schema, Document, Types } from "mongoose";

export interface IDoctorApplication extends Document {
  userId: Types.ObjectId;

  fullName: string;
  phone: string;
  email: string;
  address: string;
  
  location: {
    type: "Point";
    coordinates: [number, number];
    shortName?: string;
    fullAddress?: string;
  };

  // Qualification
  qualification: {
    degree: string; // MBBS, MD etc.
    collegeName: string;
    university: string;
    certificateUrl: string; // uploaded file URL
  };

  // Registration
  registrationNumber: string;
  medicalCouncil: string; // e.g. Kerala Medical Council

  // Experience
  experienceYears: number;
  specialization: string;

  // Profile Verification
  profileImage: string;
  selfieWithId?: string;

  // Status
  status: "pending" | "approved" | "rejected";

  // Admin review
  rejectionReason?: string;

  consultationFee: number;

  createdAt: Date;
  updatedAt: Date;
}

const DoctorApplicationSchema = new Schema<IDoctorApplication>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Personal
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, required: true },
    
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
      },
      shortName: { type: String },
      fullAddress: { type: String },
    },

    // Qualification
    qualification: {
      degree: { type: String, required: true },
      collegeName: { type: String, required: true },
      university: { type: String, required: true },
      certificateUrl: { type: String, required: true },
    },

    // Registration
    registrationNumber: { type: String, required: true },
    medicalCouncil: { type: String, required: true },

    // Experience
    experienceYears: { type: Number, required: true },
    specialization: { 
      type: String, 
      required: true,
      enum: [
        "Cardiologist",
        "Dermatologist",
        "Neurologist",
        "Orthopedic Surgeon",
        "Pediatrician",
        "Gynecologist",
        "Psychiatrist",
        "Oncologist",
        "Endocrinologist",
        "Gastroenterologist",
        "General Physician"
      ]
    },

    // Profile
    profileImage: { type: String, required: true },
    selfieWithId: { type: String },

    // Status
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    consultationFee: { type: Number, default: 0 },
    rejectionReason: { type: String },

  },
  { timestamps: true }
);

DoctorApplicationSchema.index({ location: "2dsphere" });

// Indexes for search performance
DoctorApplicationSchema.index({ userId: 1 });
DoctorApplicationSchema.index({ status: 1 });
DoctorApplicationSchema.index({ specialization: 1 });
DoctorApplicationSchema.index({ createdAt: -1 });

export const DoctorApplication = mongoose.model<IDoctorApplication>(
  "DoctorApplication",
  DoctorApplicationSchema
);
