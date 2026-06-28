import { GoogleGenerativeAI } from "@google/generative-ai";
import { EmbeddingService } from "./embedding.service.js";
import { ContextBuilderService, ContextChunk } from "./contextBuilder.service.js";
import { ChatSession } from "../models/chatSession.model.js";
import { FamilyMember } from "../models/familyMember.model.js";
import { v4 as uuidv4 } from "uuid";


const SYSTEM_PROMPT = `You are MediFind Family Health Assistant — a trusted healthcare AI integrated into the MediFind platform.

Your primary job is to answer questions about the user's family health using the medical records provided below. Follow these rules strictly:

1. NEVER make up any medicine names, diagnoses, doctors, dates, or health information.
2. For any health-related questions, ONLY answer from the retrieved context. If the health information is not in the context, clearly say: "I don't have that information in your records."
3. For general greetings and casual conversation (like "hello", "how are you"), respond naturally and politely as an AI assistant, without needing to check records.
4. Always be empathetic, clear, and easy to understand. Explain medical terms in simple language.
5. When citing specific data, mention the source (e.g., "According to your health report from March 2024...").
6. For urgent health concerns, always advise consulting a doctor in person.
7. Respect privacy: only discuss records of the currently selected family member.
8. At the end of every response, suggest 2-3 relevant follow-up questions.`;

export interface RAGResponse {
  reply: string;
  citations: ContextChunk[];
  sessionId: string;
  suggestedFollowUps: string[];
}

export class RAGService {
  /**
   * Main RAG pipeline: retrieve context, build prompt, generate LLM response.
   */
  static async chat(params: {
    userId: string;
    message: string;
    familyMemberId?: string;
    sessionId?: string;
  }): Promise<RAGResponse> {
    const { userId, message, familyMemberId, sessionId } = params;

    // 1. Resolve or create chat session
    const sid = sessionId || uuidv4();
    let session = await ChatSession.findOne({ userId, sessionId: sid });
    if (!session) {
      session = new ChatSession({
        userId,
        sessionId: sid,
        messages: [],
        activeFamilyMemberId: familyMemberId || undefined,
      });
    }

    // 2. Resolve family member details for context
    let memberName: string | undefined;
    let relationship: string | undefined;
    let linkedUserId: string | undefined;
    if (familyMemberId) {
      const member = await FamilyMember.findOne({ _id: familyMemberId, primaryUserId: userId });
      if (!member) throw new Error("Family member not found or access denied");
      memberName = member.name;
      relationship = member.relationship;
      if (member.linkedUserId && member.verificationStatus === "verified") {
        linkedUserId = member.linkedUserId.toString();
      }
    }

    // 3. Generate query embedding
    const queryEmbedding = await EmbeddingService.generateEmbedding(message);

    // 4. Semantic search on the user's health data chunks
    const searchParams: any = {
      queryEmbedding,
      primaryUserId: userId,
      topK: 8,
    };
    if (familyMemberId) searchParams.familyMemberId = familyMemberId;
    if (linkedUserId) searchParams.linkedUserId = linkedUserId;

    const retrievedChunks = await EmbeddingService.semanticSearch(searchParams);

    // 5. Build structured context from chunks + direct DB queries
    const contextParams: any = {
      primaryUserId: userId,
      retrievedChunks,
    };
    if (familyMemberId) contextParams.familyMemberId = familyMemberId;
    if (linkedUserId) contextParams.linkedUserId = linkedUserId;
    if (memberName) contextParams.memberName = memberName;

    const { contextText, citations } = await ContextBuilderService.buildContext(contextParams);

    // 6. Build conversation history (last 6 messages for context window efficiency)
    const recentMessages = session.messages.slice(-6);
    const historyText = recentMessages
      .map((m) => `${m.role === "user" ? "Patient" : "Assistant"}: ${m.content}`)
      .join("\n");

    // 7. Construct full prompt
    const memberContext = memberName
      ? `The user is asking about their family member: ${memberName} (${relationship}).`
      : "The user is asking about themselves.";

    const fullPrompt = [
      SYSTEM_PROMPT,
      "---",
      memberContext,
      "",
      "## Retrieved Health Records from MediFind Database:",
      contextText || "No specific records found for this query.",
      "",
      "## Conversation History:",
      historyText || "No previous messages.",
      "---",
      `Patient's Question: ${message}`,
    ].join("\n");

    // 8. Call Gemini LLM
    let replyText = "";
    let suggestedFollowUps: string[] = [];

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is missing or undefined");
      }
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      const result = await model.generateContent(fullPrompt);
      const rawReply = result.response.text();

      // Extract follow-up questions if present (look for lines starting with "?" or numbered)
      const lines = rawReply.split("\n");
      const followUpLines: string[] = [];
      const replyLines: string[] = [];

      let inFollowUp = false;
      for (const line of lines) {
        if (line.toLowerCase().includes("follow-up") || line.toLowerCase().includes("you might also ask")) {
          inFollowUp = true;
          continue;
        }
        if (inFollowUp && (line.trim().startsWith("-") || line.trim().match(/^\d\./))) {
          followUpLines.push(line.replace(/^[-\d.]\s*/, "").trim());
        } else {
          replyLines.push(line);
        }
      }

      replyText = replyLines.join("\n").trim();
      suggestedFollowUps = followUpLines.slice(0, 3);

      // Fallback follow-ups if LLM didn't generate them
      if (suggestedFollowUps.length === 0) {
        suggestedFollowUps = RAGService.generateDefaultFollowUps(message, memberName);
      }
    } catch (llmError: any) {
      console.error("LLM generation error:", llmError.message);
      
      // If the API key is missing or invalid, fallback to displaying the RAW MongoDB data
      // so the user can verify that MongoDB retrieval is working perfectly.
      replyText = `I am currently in fallback mode (AI generation offline). Here is the relevant health data I found for this query:\n\n${contextText ? contextText : "No recent records found in MongoDB for this family member."}`;
      suggestedFollowUps = RAGService.generateDefaultFollowUps(message, memberName);
    }

    // 9. Persist conversation to session
    session.messages.push({ role: "user", content: message, citations: [], timestamp: new Date() });
    session.messages.push({
      role: "assistant",
      content: replyText,
      citations: citations.map((c) => ({
        sourceCollection: c.sourceCollection,
        sourceId: c.sourceId,
        excerpt: c.excerpt,
      })),
      familyMemberContext: familyMemberId as any,
      timestamp: new Date(),
    });
    await session.save();

    return {
      reply: replyText,
      citations,
      sessionId: sid,
      suggestedFollowUps,
    };
  }

  /**
   * Generate default follow-up questions based on context.
   */
  private static generateDefaultFollowUps(message: string, memberName?: string): string[] {
    const name = memberName || "you";
    const lower = message.toLowerCase();

    if (lower.includes("medicine") || lower.includes("prescription")) {
      return [
        `What is the dosage schedule for ${name}'s current medicines?`,
        `Are there any side effects I should watch for?`,
        `When does ${name}'s prescription need renewal?`,
      ];
    }
    if (lower.includes("appointment") || lower.includes("doctor")) {
      return [
        `When is ${name}'s next appointment?`,
        `What was the reason for ${name}'s last doctor visit?`,
        `Which doctor has ${name} consulted most recently?`,
      ];
    }
    return [
      `What medicines is ${name} currently taking?`,
      `When was ${name}'s last doctor consultation?`,
      `Does ${name} have any upcoming appointments?`,
    ];
  }

  /**
   * Retrieve chat history for a session.
   */
  static async getChatHistory(userId: string, sessionId: string) {
    const session = await ChatSession.findOne({ userId, sessionId });
    return session ? session.messages : [];
  }

  /**
   * List all chat sessions for a user.
   */
  static async listSessions(userId: string) {
    return ChatSession.find({ userId }).sort({ updatedAt: -1 }).limit(20).select("sessionId updatedAt messages");
  }
}
