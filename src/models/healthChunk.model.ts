import mongoose, { Schema, Document, Types } from "mongoose";

export interface IHealthChunk extends Document {
  primaryUserId: Types.ObjectId;
  familyMemberId?: Types.ObjectId;
  memberName?: string;
  relationship?: string;
  sourceCollection: "healthReport" | "booking" | "order" | "searchHistory" | "familyMember";
  sourceId: string;
  chunkText: string;
  embedding: number[];
  metadata: {
    date?: Date;
    doctorName?: string;
    category?: string;
    medicines?: string[];
    status?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const HealthChunkSchema = new Schema<IHealthChunk>(
  {
    primaryUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    familyMemberId: {
      type: Schema.Types.ObjectId,
      ref: "FamilyMember",
      index: true,
    },
    memberName: { type: String },
    relationship: { type: String },
    sourceCollection: {
      type: String,
      enum: ["healthReport", "booking", "order", "searchHistory", "familyMember"],
      required: true,
    },
    sourceId: { type: String, required: true },
    chunkText: { type: String, required: true },
    embedding: { type: [Number], required: true },
    metadata: {
      date: { type: Date },
      doctorName: { type: String },
      category: { type: String },
      medicines: [{ type: String }],
      status: { type: String },
    },
  },
  { timestamps: true }
);

// Compound index for fast filtered lookups
HealthChunkSchema.index({ primaryUserId: 1, familyMemberId: 1 });
HealthChunkSchema.index({ primaryUserId: 1, sourceCollection: 1 });
HealthChunkSchema.index({ sourceId: 1, sourceCollection: 1 });

export const HealthChunk = mongoose.model<IHealthChunk>("HealthChunk", HealthChunkSchema);
