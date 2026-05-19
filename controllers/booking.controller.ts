import { Request, Response } from "express";
import { DoctorBooking } from "../models/doctor.booking.model.js";
import { DoctorApplication } from "../models/doctor.model.js";
import { getAvailblitySlots } from "../services/slot.service.js";
import { parseTimeSlot, createConsultationForBooking } from "../utils/booking.helper.js";
import { Consultation } from "../models/consultation.model.js";
import dayjs from "dayjs";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export const bookSlot = async (req: any, res: Response) => {
  try {
    const { doctorId, date, timeSlot, reason } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // 1. Check for duplicate booking for the SAME time slot
    const existingBooking = await DoctorBooking.findOne({
      doctorId,
      userId,
      date: dayjs(date).startOf("day").toDate(),
      timeSlot,
      status: { $ne: "cancelled" },
      paymentStatus: "paid",
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message:
          "You already have an active booking for this specific time slot.",
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
