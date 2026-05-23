import { Request, Response } from "express";
import { HealthReport } from "../../models/healthReport.model.js";
import { DoctorBooking } from "../../models/doctor.booking.model.js";
import { DoctorApplication } from "../../models/doctor.model.js";
import { Medicine } from "../../models/medicine.model.js";
import { getRemainingPrescribedQty } from "../usercontrollers/cart.controller.js";

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

    // Validate medicine stock limit, dosage, and instructions
    if (medicines && Array.isArray(medicines)) {
      for (const med of medicines) {
        if (!med.medicineId) {
          return res.status(400).json({ success: false, message: "Each medicine must have a medicineId" });
        }
        const dbMedicine = await Medicine.findById(med.medicineId);
        if (!dbMedicine) {
          return res.status(404).json({ success: false, message: `Medicine not found for ID: ${med.medicineId}` });
        }
        if (!med.dosage || !med.dosage.trim()) {
          return res.status(400).json({ success: false, message: `Dosage schedule is required for ${med.name || dbMedicine.name}` });
        }
        if (!med.instructions || !med.instructions.trim()) {
          return res.status(400).json({ success: false, message: `Instructions are required for ${med.name || dbMedicine.name}` });
        }
        const stock = dbMedicine.stock || 0;
        if (med.quantity > stock) {
          return res.status(400).json({
            success: false,
            message: `Cannot prescribe ${med.name || dbMedicine.name} with quantity ${med.quantity}. Available stock is only ${stock}.`
          });
        }
      }
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

    const reportObj = report.toObject();
    if (reportObj.medicines && Array.isArray(reportObj.medicines)) {
      for (const med of reportObj.medicines) {
        const dbMed = await Medicine.findById(med.medicineId);
        (med as any).stock = dbMed ? dbMed.stock : 0;
        if (med.medicineId) {
          const remainingQty = await getRemainingPrescribedQty(booking.userId.toString(), med.medicineId.toString());
          (med as any).remainingQty = remainingQty !== undefined ? remainingQty : med.quantity;
        } else {
          (med as any).remainingQty = med.quantity;
        }
      }
    }

    return res.status(200).json({ success: true, report: reportObj });
  } catch (error: any) {
    console.error("Get Health Report Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
