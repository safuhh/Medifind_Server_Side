

import { Consultation } from "../../models/consultation.model.js";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";

// Function to generate Jitsi JWT if credentials exist
const generateJitsiToken = (user: any, roomId: string) => {
  const appId = process.env.JITSI_APP_ID;
  const secret = process.env.JITSI_APP_SECRET;

  if (!appId || !secret) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 30 * 60; // 30 mins session expiration from token generation

  const payload = {
    iss: appId,
    aud: appId,
    sub: appId,
    room: roomId,
    nbf: now - 10,
    exp: exp,
    context: {
      user: {
        name: user.name,
        email: user.email,
        id: user.id || user._id?.toString(),
        avatar: "",
        moderator: user.role === "doctor"
      },
      features: {
        livestreaming: "false",
        recording: "false",
        transcription: "false",
        "outbound-call": "false"
      }
    }
  };

  return jwt.sign(payload, secret, { algorithm: "HS256" });
};

export const getConsultation = async (req: any, res: Response) => {
  try {
    const consultation = req.consultation; // attached by verifyConsultationAccess middleware
    
    if (consultation.status === "completed") {
      return res.json({
        success: true,
        consultation,
        isAllowed: false,
        timeMessage: "This consultation has already been completed.",
        remainingSeconds: 0
      });
    }

    if (consultation.status === "cancelled") {
      return res.json({
        success: true,
        consultation,
        isAllowed: false,
        timeMessage: "This consultation has been cancelled.",
        remainingSeconds: 0
      });
    }

    // Enforce server-side time validation
    const scheduledTime = consultation.scheduledAt ? new Date(consultation.scheduledAt) : new Date(consultation.createdAt);
    const now = new Date();
    const endTime = new Date(scheduledTime.getTime() + 30 * 60 * 1000); // 30 minutes duration

    let isAllowed = false;
    let timeMessage = "";
    let remainingSeconds = 0;

    if (now < scheduledTime) {
      isAllowed = false;
      const formattedTime = scheduledTime.toLocaleString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
      timeMessage = `This consultation is scheduled for ${formattedTime}. You can only join once the scheduled time arrives.`;
    } else if (now > endTime) {
      isAllowed = false;
      timeMessage = "This consultation session has expired.";
    } else {
      isAllowed = true;
      remainingSeconds = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
    }

    // Generate Jitsi Token if credentials are provided in env and time is valid
    let jitsiToken = null;
    if (isAllowed && req.user) {
      jitsiToken = generateJitsiToken(req.user, consultation.roomId);
    }

    res.json({
      success: true,
      consultation,
      isAllowed,
      timeMessage,
      remainingSeconds,
      jitsiToken,
      jitsiAppId: process.env.JITSI_APP_ID || null
    });
  } catch (error: any) {
    console.error("Error in getConsultation:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const completeConsultation = async (req: any, res: Response) => {
  try {
    const consultation = req.consultation; // attached by verifyConsultationAccess middleware

    if (!req.user || req.user.role !== "doctor") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only the assigned doctor can complete this consultation."
      });
    }

    const now = new Date();
    if (consultation.scheduledAt && now < consultation.scheduledAt) {
      const booking = consultation.bookingId as any;
      const slotStr = booking?.timeSlot || "";
      return res.status(400).json({
        success: false,
        message: `You cannot mark this consultation as completed before its scheduled time (${slotStr}).`
      });
    }

    consultation.status = "completed";
    await consultation.save();

    // Emit event via socket to immediately close the room on frontend
    const io = req.app.get("io");
    if (io) {
      io.to(consultation.roomId).emit("consultation_status_changed", {
        status: "completed",
        roomId: consultation.roomId
      });
      console.log(`Emitted consultation_status_changed event to room: ${consultation.roomId}`);
    }

    res.json({ success: true, consultation });
  } catch (error: any) {
    console.error("Error in completeConsultation:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
