import mongoose, { Schema, Document, Types } from "mongoose";

export interface IChatMessage {
  role: "user" | "assistant";
  content: string;
  citations: {
    sourceCollection: string;
    sourceId: string;
    excerpt: string;
  }[];
  familyMemberContext?: Types.ObjectId;
  timestamp: Date;
}

export interface IChatSession extends Document {
  userId: Types.ObjectId;
  sessionId: string;
  messages: IChatMessage[];
  activeFamilyMemberId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>({
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true },
  citations: [
    {
      sourceCollection: { type: String },
      sourceId: { type: String },
      excerpt: { type: String },
    },
  ],
  familyMemberContext: { type: Schema.Types.ObjectId, ref: "FamilyMember" },
  timestamp: { type: Date, default: Date.now },
});

const ChatSessionSchema = new Schema<IChatSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sessionId: { type: String, required: true, unique: true },
    messages: [ChatMessageSchema],
    activeFamilyMemberId: {
      type: Schema.Types.ObjectId,
      ref: "FamilyMember",
    },
  },
  { timestamps: true }
);

ChatSessionSchema.index({ userId: 1, updatedAt: -1 });

export const ChatSession = mongoose.model<IChatSession>("ChatSession", ChatSessionSchema);
