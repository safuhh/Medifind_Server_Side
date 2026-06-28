// booking time slot and create consultation
import dayjs from "dayjs";
import crypto from "crypto";
import { Consultation } from "../models/consultation.model.js";

export const parseTimeSlot = (date: Date, timeSlot: string) => {
  let hours = 0;
  let minutes = 0;

  if (timeSlot) {
    const parts = timeSlot.split(" ");
    const timeParts = parts[0] ? parts[0].split(":") : [];
    hours = parseInt(timeParts[0] || "0", 10);
    minutes = parseInt(timeParts[1] || "0", 10);
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

export const createConsultationForBooking = async (booking: any) => {
  const random = crypto.randomBytes(16).toString("hex");

  const userId = booking.userId._id || booking.userId;
  const roomId = `consultation_${booking.doctorId}_${userId}_${random}`;
  const scheduledAt = parseTimeSlot(booking.date, booking.timeSlot);

  return await Consultation.create({
    doctorId: booking.doctorId,
    patientId: userId,
    familyMemberId: booking.familyMemberId,
    bookingId: booking._id,
    roomId: roomId,
    scheduledAt: scheduledAt,
    status: "scheduled",
  });
};
