import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/authRequest.js";
import { Consultation } from "../models/consultation.model.js";
import { DoctorApplication } from "../models/doctor.model.js";

export interface ConsultationRequest extends AuthRequest {
  consultation?: any;
}

export const verifyConsultationAccess = async (
  req: ConsultationRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { roomId } = req.params;
    
    if (!roomId) {
      return res.status(400).json({ success: false, message: "Room ID is required" });
    }

    const consultation = await Consultation.findOne({ roomId }).populate("bookingId");
    
    if (!consultation) {
      return res.status(404).json({ success: false, message: "Consultation not found" });
    }
    
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }
    
    const userId = req.user.id || req.user._id?.toString();
    const patIdStr = consultation.patientId.toString();
    
    // Check if the user is the patient
    if (userId === patIdStr) {
      req.consultation = consultation;
      return next();
    }
    
    // Check if the user is the doctor
    if (req.user.role === "doctor") {
      const doctorApp = await DoctorApplication.findById(consultation.doctorId);
      if (doctorApp && doctorApp.userId.toString() === userId) {
        req.consultation = consultation;
        return next();
      }
    }
    
    // Access denied if neither matched
    console.log(`Access Denied: User ${userId} is not assigned to Consultation ${roomId}`);
    return res.status(403).json({
      success: false,
      message: "Access denied. You are not assigned to this consultation.",
    });
    
  } catch (error: any) {
    console.error("Error verifying consultation access:", error);
    res.status(500).json({ success: false, message: "Server error during authorization" });
  }
};
