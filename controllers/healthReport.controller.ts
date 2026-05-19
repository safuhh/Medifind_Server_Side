import { Request, Response } from "express";
import { HealthReport } from "../models/healthReport.model.js";
import { DoctorBooking } from "../models/doctor.booking.model.js";
import { DoctorApplication } from "../models/doctor.model.js";

export const createHealthReport = async (req: any, res: Response) => {
  try {
    const { bookingId, notes, medicines } = req.body;
    const userId = req.user?.id;

    // 1. Find doctor profile
    const doctor = await DoctorApplication.findOne({ userId });
    if (!doctor) {
      return res.status(403).json({ success: false, message: "Only doctors can create health reports" });
    }

    // 2. Verify booking belongs to this doctor
    const booking = await DoctorBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.doctorId.toString() !== doctor._id.toString()) {
      return res.status(403).json({ success: false, message: "You are not authorized to create a report for this booking" });
    }

    // 3. Create or Update health report
    const report = await HealthReport.findOneAndUpdate(
      { bookingId },
      {
        doctorId: doctor._id,
        patientId: booking.userId,
        notes,
        medicines,
      },
      { new: true, upsert: true }
    );

    return res.status(200).json({ success: true, report });
  } catch (error: any) {
    console.error("Create Health Report Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

export const getHealthReportByBooking = async (req: any, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user?.id;

    // 1. Verify booking exists and user is authorized
    const booking = await DoctorBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const doctorProfile = await DoctorApplication.findOne({ userId });
    const isPatient = booking.userId.toString() === userId;
    const isDoctor = doctorProfile && booking.doctorId.toString() === doctorProfile._id.toString();

    if (!isPatient && !isDoctor) {
      return res.status(403).json({ success: false, message: "Unauthorized to view this report" });
    }

    // 2. Fetch the report
    const report = await HealthReport.findOne({ bookingId })
      .populate("doctorId", "fullName specialization profileImage")
      .populate("patientId", "name email");

    if (!report) {
      return res.status(200).json({ success: true, report: null });
    }

    return res.status(200).json({ success: true, report });
  } catch (error: any) {
    console.error("Get Health Report Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
