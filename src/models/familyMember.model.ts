import mongoose, { Schema, Document, Types } from "mongoose";

export type Relationship =
  | "self"
  | "mother"
  | "father"
  | "spouse"
  | "child"
  | "grandfather"
  | "grandmother"
  | "sibling"
  | "other";

export interface IFamilyMember extends Document {
  primaryUserId: Types.ObjectId;
  linkedUserId?: Types.ObjectId;
  name: string;
  relationship: Relationship;
  dateOfBirth?: Date;
  gender?: "male" | "female" | "other";
  bloodGroup?: string;
  allergies: string[];
  chronicDiseases: string[];
  profileImage?: string;
  emergencyContact?: {
    name: string;
    phone: string;
  };
  isDefault: boolean;
  verificationStatus: "unlinked" | "pending" | "verified";
  verificationCode?: string;
  verificationCodeExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FamilyMemberSchema = new Schema<IFamilyMember>(
  {
    primaryUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    linkedUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    name: { type: String, required: true, trim: true },
    relationship: {
      type: String,
      enum: ["self", "mother", "father", "spouse", "child", "grandfather", "grandmother", "sibling", "other"],
      required: true,
    },
    dateOfBirth: { type: Date },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    },
    allergies: [{ type: String, trim: true }],
    chronicDiseases: [{ type: String, trim: true }],
    profileImage: { type: String },
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
    isDefault: { type: Boolean, default: false },
    verificationStatus: {
      type: String,
      enum: ["unlinked", "pending", "verified"],
      default: "unlinked",
    },
    verificationCode: { type: String },
    verificationCodeExpiresAt: { type: Date },
  },
  { timestamps: true }
);

FamilyMemberSchema.index({ primaryUserId: 1, relationship: 1 });
FamilyMemberSchema.index({ primaryUserId: 1, isDefault: 1 });

export const FamilyMember = mongoose.model<IFamilyMember>("FamilyMember", FamilyMemberSchema);
