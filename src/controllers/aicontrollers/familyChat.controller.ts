import { Request, Response } from "express";
import { RAGService } from "../../services/rag.service.js";
import { FamilyMember } from "../../models/familyMember.model.js";
import { HealthReport } from "../../models/healthReport.model.js";
import { DoctorBooking } from "../../models/doctor.booking.model.js";
import { Order } from "../../models/order.model.js";

/**
 * POST /api/ai/family/chat
 * Main RAG-powered chat endpoint.
 */
export const familyChat = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { message, familyMemberId, sessionId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "Message is required" });
    }

    // Security: if familyMemberId provided, verify it belongs to this user
    if (familyMemberId) {
      const member = await FamilyMember.findOne({ _id: familyMemberId, primaryUserId: userId });
      if (!member) {
        return res.status(403).json({ success: false, message: "Access denied to this family member's data" });
      }
    }

    const result = await RAGService.chat({
      userId,
      message: message.trim(),
      familyMemberId,
      sessionId,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    console.error("familyChat error:", error);
    return res.status(500).json({ success: false, message: error.message || "AI chat failed" });
  }
};

/**
 * GET /api/ai/family/chat/history?sessionId=xxx
 * Retrieve chat history for a session.
 */
export const getChatHistory = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId is required" });
    }

    const messages = await RAGService.getChatHistory(userId, sessionId as string);
    return res.status(200).json({ success: true, messages });
  } catch (error: any) {
    console.error("getChatHistory error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch chat history" });
  }
};

/**
 * GET /api/ai/family/summary
 * Weekly family health activity summary.
 */
export const getFamilyHealthSummary = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Family members
    const members = await FamilyMember.find({ primaryUserId: userId }).select("name relationship");

    // Recent health reports
    const recentReports = await HealthReport.find({
      patientId: userId,
      createdAt: { $gte: oneWeekAgo },
    })
      .populate("doctorId", "fullName specialization")
      .populate("familyMemberId", "name relationship")
      .sort({ createdAt: -1 })
      .limit(5);

    // Upcoming appointments (next 7 days)
    const upcomingBookings = await DoctorBooking.find({
      userId,
      date: { $gte: new Date(), $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      paymentStatus: "paid",
      status: { $ne: "cancelled" },
    })
      .populate("doctorId", "fullName specialization")
      .populate("familyMemberId", "name relationship")
      .sort({ date: 1 })
      .limit(5);

    // Recent orders
    const recentOrders = await Order.find({
      userId,
      createdAt: { $gte: oneWeekAgo },
      paymentStatus: "paid",
    })
      .populate("items.medicineId", "name")
      .populate("familyMemberId", "name relationship")
      .sort({ createdAt: -1 })
      .limit(5);

    return res.status(200).json({
      success: true,
      summary: {
        totalMembers: members.length,
        members,
        recentReports,
        upcomingBookings,
        recentOrders,
        weekOf: oneWeekAgo.toLocaleDateString(),
      },
    });
  } catch (error: any) {
    console.error("getFamilyHealthSummary error:", error);
    return res.status(500).json({ success: false, message: "Failed to generate summary" });
  }
};
