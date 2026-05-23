import { Response } from "express";
import { DoctorBooking } from "../../models/doctor.booking.model.js";
import { DoctorApplication } from "../../models/doctor.model.js";
import { User } from "../../models/user.model.js";
import { HealthReport } from "../../models/healthReport.model.js";

export const getDoctorPatients = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const doctor = await DoctorApplication.findOne({ userId });

    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor profile not found" });
    }

    const bookings = await DoctorBooking.find({ doctorId: doctor._id })
      .populate("userId", "name email phone image")
      .sort({ createdAt: -1 });

    const patientsMap = new Map();
    bookings.forEach((booking: any) => {
      if (booking.userId && !patientsMap.has(booking.userId._id.toString())) {
        patientsMap.set(booking.userId._id.toString(), {
          ...booking.userId.toObject(),
          lastVisit: booking.date,
          bookingStatus: booking.status
        });
      }
    });

    const patients = Array.from(patientsMap.values());

    return res.status(200).json({ success: true, patients });
  } catch (error: any) {
    console.error("Fetch Doctor Patients Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getPatientDetails = async (req: any, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = req.user?.id;
    const doctor = await DoctorApplication.findOne({ userId });

    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor profile not found" });
    }

    const patient = await User.findById(patientId).select("name email phone image location");
    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    const bookings = await DoctorBooking.find({ 
      doctorId: doctor._id, 
      userId: patientId 
    }).sort({ date: -1 });

    const bookingIds = bookings.map(b => b._id);
    const healthReports = await HealthReport.find({ 
      bookingId: { $in: bookingIds } 
    }).sort({ createdAt: -1 });

    return res.status(200).json({ 
      success: true, 
      patient,
      history: bookings.map(booking => ({
        ...booking.toObject(),
        report: healthReports.find(r => r.bookingId.toString() === booking._id.toString())
      }))
    });
  } catch (error: any) {
    console.error("Fetch Patient Details Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
