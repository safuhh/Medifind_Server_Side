import { Request, Response } from "express";
import { DoctorBooking } from "../models/doctor.booking.model.js";
import { DoctorApplication } from "../models/doctor.model.js";
import { getAvailblitySlots } from "../services/slot.service.js";
import { Consultation } from "../models/consultation.model.js";
import dayjs from "dayjs";
import Stripe from "stripe";
import crypto from "crypto";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

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

export const getSlots = async (req: Request, res: Response) => {
  try {
    const { doctorId, date } = req.body;
    const slots = await getAvailblitySlots(doctorId, date as string);
    return res.status(200).json({ success: true, slots });
  } catch (error) {
    console.error("Get Slots Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
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

export const bookSlot = async (req: any, res: Response) => {
  try {
    const { doctorId, date, timeSlot, reason } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // 1. Check for duplicate booking on the same day
    const existingBooking = await DoctorBooking.findOne({
      doctorId,
      userId,
      date: dayjs(date).startOf("day").toDate(),
      status: { $ne: "cancelled" },
      paymentStatus: "paid",
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message:
          "You already have an active booking with this doctor for the selected date.",
      });
    }

    // 2. Check slot availability
    const availableSlots = await getAvailblitySlots(doctorId, date as string);
    if (!availableSlots.includes(timeSlot)) {
      return res
        .status(400)
        .json({ success: false, message: "Selected slot is not available" });
    }

    // 3. Get Doctor's Consultation Fee
    const doctor = await DoctorApplication.findById(doctorId);
    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }

    const fee = doctor.consultationFee || 500;

    // 4. Create Stripe PaymentIntent
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: fee * 100,
        currency: "inr",
        payment_method_types: ["card"],
        metadata: { doctorId, userId, date, timeSlot, reason },
      });
    } catch (stripeError: any) {
      console.error("STRIPE INTENT ERROR:", stripeError.message);
      // Fallback for missing keys
      if (
        !process.env.STRIPE_SECRET_KEY ||
        process.env.STRIPE_SECRET_KEY === "sk_test_placeholder"
      ) {
        paymentIntent = {
          id: "mock_intent_" + Date.now(),
          client_secret: "mock_secret_" + Date.now(),
        };
      } else {
        throw stripeError;
      }
    }

    const booking = await DoctorBooking.create({
      doctorId,
      userId,
      date: dayjs(date).startOf("day").toDate(),
      timeSlot,
      reason,
      amount: fee,
      stripeSessionId: paymentIntent.id,
      paymentStatus: "pending",
    });

    // Emit socket event
    const io = req.app.get("io");
    io.to(doctorId).emit("slot_booked", {
      doctorId,
      date,
      timeSlot,
      patientName: req.user.name,
      bookingId: booking._id,
    });

    return res.status(200).json({
      success: true,
      booking,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error: any) {
    console.error("Booking Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const confirmPayment = async (req: Request, res: Response) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res
        .status(400)
        .json({ success: false, message: "Payment Intent ID is required" });
    }

    const booking = await DoctorBooking.findOneAndUpdate(
      { stripeSessionId: paymentIntentId },
      { paymentStatus: "paid" },
      { new: true },
    );

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    // Check if consultation room already exists
    let consultation = await Consultation.findOne({ bookingId: booking._id });

    if (!consultation) {
      consultation = await createConsultationForBooking(booking);
    }

    // Emit socket event
    const io = req.app.get("io");
    io.to(booking.doctorId.toString()).emit("payment_confirmed", {
      bookingId: booking._id,
      status: "paid",
    });

    return res
      .status(200)
      .json({ success: true, booking, roomId: consultation.roomId });
  } catch (error: any) {
    console.error("Confirm Payment Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
