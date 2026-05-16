import { Response } from "express";
import { DoctorBooking } from "../models/doctor.booking.model.js";
import { DoctorApplication } from "../models/doctor.model.js";
import { Consultation } from "../models/consultation.model.js";
import dayjs from "dayjs";
import crypto from "crypto";

const parseTimeSlot = (date: Date, timeSlot: string) => {
  let hours = 0;
  let minutes = 0;

  if (timeSlot) {
    const parts = timeSlot.split(" ");
    const timeParts = parts[0].split(":");
    hours = parseInt(timeParts[0]);
    minutes = parseInt(timeParts[1]);
    const modifier = parts[1];

    if (modifier === "PM" && hours < 12) hours += 12;
    if (modifier === "AM" && hours === 12) hours = 0;
  }

  return dayjs(date)
    .startOf("day")
    .add(hours, "hour")
    .add(minutes, "minute")
    .toDate();
};

const createConsultationForBooking = async (booking: any) => {
  const random = crypto.randomBytes(16).toString("hex");

  const userId = booking.userId._id || booking.userId;
  const roomId = `consultation_${booking.doctorId}_${userId}_${random}`;
  const scheduledAt = parseTimeSlot(booking.date, booking.timeSlot);

  return await Consultation.create({
    doctorId: booking.doctorId,
    patientId: userId,
    bookingId: booking._id,
    roomId: roomId,
    scheduledAt: scheduledAt,
    status: "scheduled",
  });
};

export const getDoctorAppointments = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const doctor = await DoctorApplication.findOne({ userId });

    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor profile not found" });
    }

    const bookings = await DoctorBooking.find({ doctorId: doctor._id })
      .populate("userId", "name email phone")
      .sort({ date: 1, timeSlot: 1 });

    const bookingIds = bookings.map((b) => b._id);
    const consultations = await Consultation.find({
      bookingId: { $in: bookingIds },
    });

    const bookingsWithRooms = await Promise.all(
      bookings.map(async (booking) => {
        let consultation = consultations.find(
          (c) => c.bookingId?.toString() === booking._id.toString(),
        );

        // Auto-create room if missing for paid bookings
        if (!consultation && booking.paymentStatus === "paid") {
          consultation = await createConsultationForBooking(booking);
        }

        return {
          ...booking.toObject(),
          roomId: consultation ? consultation.roomId : null,
          scheduledAt: consultation ? consultation.scheduledAt : null,
          consultationStatus: consultation ? consultation.status : null,
        };
      }),
    );

    return res.status(200).json({ success: true, bookings: bookingsWithRooms });
  } catch (error: any) {
    console.error("Fetch Appointments Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

export const getPatientAppointments = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;

    const bookings = await DoctorBooking.find({ userId })
      .populate("doctorId", "fullName profileImage specialization")
      .sort({ date: 1, timeSlot: 1 });

    const bookingIds = bookings.map((b) => b._id);
    const consultations = await Consultation.find({
      bookingId: { $in: bookingIds },
    });

    const bookingsWithRooms = bookings.map((booking) => {
      const consultation = consultations.find(
        (c) => c.bookingId?.toString() === booking._id.toString(),
      );
      return {
        ...booking.toObject(),
        roomId: consultation ? consultation.roomId : null,
        scheduledAt: consultation ? consultation.scheduledAt : null,
        consultationStatus: consultation ? consultation.status : null,
      };
    });

    return res.status(200).json({ success: true, bookings: bookingsWithRooms });
  } catch (error: any) {
    console.error("Fetch Patient Appointments Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
