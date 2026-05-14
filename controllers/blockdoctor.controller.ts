import { Response } from "express";
import { AuthRequest } from "../types/authRequest.js";
import { User } from "../models/user.model.js";
export const getAllDoctors = async (req: AuthRequest, res: Response) => {
  try {
    const doctors = await User.find({ role: "doctor" });
    return res.status(200).json({ success: true, doctors });
  } catch (error: any) {
    console.error("GET_ALL_DOCTORS_ERROR:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
export const blockDoctor = async (req: AuthRequest, res: Response) => {
  try {
    const { doctorId } = req.params;

    if (!doctorId) {
      return res.status(400).json({ message: "No doctor ID provided" });
    }

    const doctor = await User.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Set blocked status
    doctor.isBlocked = true;
    await doctor.save();

    return res.status(200).json({
      message: "Doctor blocked successfully",
      doctor,
    });
  } catch (error: any) {
    console.error("BLOCK_DOCTOR_ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
export const unblockDoctor = async (req: AuthRequest, res: Response) => {
  try {
    const { doctorId } = req.params;

    if (!doctorId) {
      return res.status(400).json({ message: "No doctor ID provided" });
    }

    const doctor = await User.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Set blocked status
    doctor.isBlocked = false;
    await doctor.save();

    return res.status(200).json({
      message: "Doctor unblocked successfully",
      doctor,
    });
  } catch (error: any) {
    console.error("BLOCK_DOCTOR_ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
