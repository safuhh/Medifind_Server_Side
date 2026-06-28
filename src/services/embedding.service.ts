import { GoogleGenerativeAI } from "@google/generative-ai";
import { HealthChunk } from "../models/healthChunk.model.js";
import { IFamilyMember } from "../models/familyMember.model.js";
import { Types } from "mongoose";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export class EmbeddingService {
  /**
   * Generate a 768-dimensional embedding vector for a given text.
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    try {
      const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (error: any) {
      console.error("Embedding generation failed:", error.message);
      if (error.message.includes("API key not valid") || error.message.includes("API key not provided") || error.message.includes("Error fetching from https")) {
        // Return a mock embedding array of 768 zeros if the API key is invalid, 
        // to prevent the app from crashing and allow direct MongoDB context fetching to proceed.
        return new Array(768).fill(0);
      }
      throw new Error("Failed to generate embedding");
    }
  }

  /**
   * Upsert an embedding chunk into the HealthChunk collection.
   */
  static async upsertChunk(params: {
    primaryUserId: string | Types.ObjectId;
    familyMemberId?: string | Types.ObjectId;
    memberName?: string;
    relationship?: string;
    sourceCollection: "healthReport" | "booking" | "order" | "searchHistory" | "familyMember";
    sourceId: string;
    chunkText: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const { primaryUserId, familyMemberId, memberName, relationship, sourceCollection, sourceId, chunkText, metadata } = params;

    const embedding = await EmbeddingService.generateEmbedding(chunkText);

    await HealthChunk.findOneAndUpdate(
      { sourceId, sourceCollection },
      {
        primaryUserId,
        familyMemberId,
        memberName,
        relationship,
        sourceCollection,
        sourceId,
        chunkText,
        embedding,
        metadata: metadata || {},
      },
      { upsert: true, new: true }
    );
  }

  /**
   * Index a HealthReport document.
   */
  static async indexHealthReport(report: any, primaryUserId: string): Promise<void> {
    const medicinesList = (report.medicines || []).map((m: any) => `${m.name} (${m.dosage})`).join(", ");
    const chunkText = [
      `Doctor visit on ${report.createdAt ? new Date(report.createdAt).toLocaleDateString() : "unknown date"}.`,
      report.diagnosisText ? `Diagnosis: ${report.diagnosisText}.` : "",
      `Notes: ${report.notes || ""}`,
      medicinesList ? `Prescribed medicines: ${medicinesList}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    await EmbeddingService.upsertChunk({
      primaryUserId,
      familyMemberId: report.familyMemberId,
      sourceCollection: "healthReport",
      sourceId: report._id.toString(),
      chunkText,
      metadata: {
        date: report.createdAt,
        medicines: (report.medicines || []).map((m: any) => m.name),
      },
    });
  }

  /**
   * Index a DoctorBooking document.
   */
  static async indexBooking(booking: any, primaryUserId: string, doctorName?: string): Promise<void> {
    const chunkText = [
      `Appointment with Dr. ${doctorName || "unknown"} on ${booking.date ? new Date(booking.date).toLocaleDateString() : "unknown date"} at ${booking.timeSlot}.`,
      `Status: ${booking.status}. Payment: ${booking.paymentStatus}.`,
      booking.reason ? `Reason: ${booking.reason}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    await EmbeddingService.upsertChunk({
      primaryUserId,
      familyMemberId: booking.familyMemberId,
      sourceCollection: "booking",
      sourceId: booking._id.toString(),
      chunkText,
      metadata: {
        date: booking.date,
        doctorName,
        status: booking.status,
      },
    });
  }

  /**
   * Index an Order document.
   */
  static async indexOrder(order: any, primaryUserId: string, medicineNames: string[]): Promise<void> {
    const chunkText = [
      `Medicine order placed on ${order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "unknown date"}.`,
      `Items: ${medicineNames.join(", ")}.`,
      `Total: ₹${order.totalAmount}. Order status: ${order.orderStatus}. Payment: ${order.paymentStatus}.`,
    ].join(" ");

    await EmbeddingService.upsertChunk({
      primaryUserId,
      familyMemberId: order.familyMemberId,
      sourceCollection: "order",
      sourceId: order._id.toString(),
      chunkText,
      metadata: {
        date: order.createdAt,
        medicines: medicineNames,
        status: order.orderStatus,
      },
    });
  }

  /**
   * Index a FamilyMember profile.
   */
  static async indexFamilyMember(member: IFamilyMember, primaryUserId: string): Promise<void> {
    const chunkText = [
      `Family member: ${member.name} (${member.relationship}).`,
      member.dateOfBirth ? `Date of birth: ${new Date(member.dateOfBirth).toLocaleDateString()}.` : "",
      member.bloodGroup ? `Blood group: ${member.bloodGroup}.` : "",
      member.allergies?.length ? `Allergies: ${member.allergies.join(", ")}.` : "No known allergies.",
      member.chronicDiseases?.length ? `Chronic conditions: ${member.chronicDiseases.join(", ")}.` : "No chronic conditions recorded.",
    ]
      .filter(Boolean)
      .join(" ");

    await EmbeddingService.upsertChunk({
      primaryUserId,
      familyMemberId: member._id as Types.ObjectId,
      memberName: member.name,
      relationship: member.relationship,
      sourceCollection: "familyMember",
      sourceId: member._id.toString(),
      chunkText,
    });
  }

  /**
   * Perform semantic vector search against the user's health data.
   * Falls back to simple text search if vector index is not available.
   */
  static async semanticSearch(params: {
    queryEmbedding: number[];
    primaryUserId: string;
    familyMemberId?: string;
    linkedUserId?: string;
    topK?: number;
  }): Promise<any[]> {
    const { queryEmbedding, primaryUserId, familyMemberId, linkedUserId, topK = 8 } = params;

    try {
      let filter: any;
      if (familyMemberId && linkedUserId) {
        filter = {
          $or: [
            { primaryUserId: new Types.ObjectId(primaryUserId), familyMemberId: new Types.ObjectId(familyMemberId) },
            { primaryUserId: new Types.ObjectId(linkedUserId) }
          ]
        };
      } else if (familyMemberId) {
        filter = { primaryUserId: new Types.ObjectId(primaryUserId), familyMemberId: new Types.ObjectId(familyMemberId) };
      } else {
        filter = { primaryUserId: new Types.ObjectId(primaryUserId) };
      }

      // Try MongoDB Atlas Vector Search
      const pipeline: any[] = [
        {
          $vectorSearch: {
            index: "healthChunkVectorIndex",
            path: "embedding",
            queryVector: queryEmbedding,
            numCandidates: 100,
            limit: topK,
            filter: filter,
          },
        },
        {
          $project: {
            chunkText: 1,
            sourceCollection: 1,
            sourceId: 1,
            memberName: 1,
            relationship: 1,
            metadata: 1,
            score: { $meta: "vectorSearchScore" },
          },
        },
      ];

      const results = await HealthChunk.aggregate(pipeline);
      return results;
    } catch (atlasError: any) {
      // Fallback: simple text search for environments without Atlas Vector Search
      console.warn("Atlas vector search unavailable, falling back to text search:", atlasError.message);
      
      let fallbackFilter: any;
      if (familyMemberId && linkedUserId) {
        fallbackFilter = {
          $or: [
            { primaryUserId, familyMemberId },
            { primaryUserId: linkedUserId }
          ]
        };
      } else if (familyMemberId) {
        fallbackFilter = { primaryUserId, familyMemberId };
      } else {
        fallbackFilter = { primaryUserId };
      }

      const results = await HealthChunk.find(fallbackFilter)
        .sort({ createdAt: -1 })
        .limit(topK)
        .lean();
      return results;
    }
  }
}
