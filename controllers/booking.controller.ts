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
    return dayjs(date).startOf("day").add(hours, "hour").add(minutes, "minute").toDate();
};

export const getslots = async (req: Request, res: Response) => {
    try {
        const { doctorId, date } = req.body;
        const slots = await getAvailblitySlots(doctorId, date as string);
        return res.status(200).json({ success: true, slots });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getDoctorAppointments = async (req: any, res: Response) => {
    try {
        const userId = req.user?.id;
        const doctor = await DoctorApplication.findOne({ userId });
        if (!doctor) {
            return res.status(404).json({ success: false, message: "Doctor profile not found" });
        }

        const bookings = await DoctorBooking.find({ doctorId: doctor._id })
            .populate("userId", "name email phone")
            .sort({ date: 1, timeSlot: 1 });

        // Fetch consultations for these bookings
        const bookingIds = bookings.map(b => b._id);
        const consultations = await Consultation.find({ bookingId: { $in: bookingIds } });

        // Map consultations to bookings and auto-create if missing for paid ones
        const bookingsWithRooms = await Promise.all(bookings.map(async (booking) => {
            let consultation = consultations.find(c => c.bookingId?.toString() === booking._id.toString());
            
            if (!consultation && booking.paymentStatus === "paid") {
                const random = crypto.randomBytes(16).toString("hex");
                const roomid = `consultation_${booking.doctorId}_${booking.userId._id}_${random}`;
                const scheduledAt = parseTimeSlot(booking.date, booking.timeSlot);
                
                consultation = await Consultation.create({
                    doctorId: booking.doctorId,
                    patientId: booking.userId._id,
                    bookingId: booking._id,
                    roomId: roomid,
                    scheduledAt: scheduledAt,
                    status: "scheduled"
                });
            }

            return {
                ...booking.toObject(),
                roomId: consultation ? consultation.roomId : null,
                scheduledAt: consultation ? consultation.scheduledAt : null,
                consultationStatus: consultation ? consultation.status : null
            };
        }));

        return res.status(200).json({ success: true, bookings: bookingsWithRooms });
    } catch (error: any) {
        console.error("Fetch Appointments Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getPatientAppointments = async (req: any, res: Response) => {
    try {
        const userId = req.user?.id;
        
        const bookings = await DoctorBooking.find({ userId })
            .populate("doctorId", "name")
            .sort({ date: 1, timeSlot: 1 });

        const bookingIds = bookings.map(b => b._id);
        const consultations = await Consultation.find({ bookingId: { $in: bookingIds } });

        const bookingsWithRooms = bookings.map(booking => {
            const consultation = consultations.find(c => c.bookingId?.toString() === booking._id.toString());
            return {
                ...booking.toObject(),
                roomId: consultation ? consultation.roomId : null,
                scheduledAt: consultation ? consultation.scheduledAt : null,
                consultationStatus: consultation ? consultation.status : null
            };
        });

        return res.status(200).json({ success: true, bookings: bookingsWithRooms });
    } catch (error: any) {
        console.error("Fetch Patient Appointments Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const bookslote = async (req: any, res: Response) => {
    try {
        const { doctorId, date, timeSlot, reason } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        // 1. Check for multiple bookings by same user for same doctor on same date
        const existingBooking = await DoctorBooking.findOne({
            doctorId,
            userId,
            date: dayjs(date).startOf("day").toDate(),
            status: { $ne: "cancelled" }
        });

        if (existingBooking) {
            return res.status(400).json({ 
                success: false, 
                message: "You already have an active booking with this doctor for the selected date." 
            });
        }

        // 2. Check slot availability
        const availbleslote = await getAvailblitySlots(doctorId, date as string);
        if (!availbleslote.includes(timeSlot)) {
            return res.status(400).json({ success: false, message: "Selected slot is not available" });
        }

        // 3. Get Doctor's Consultation Fee
        const doctor = await DoctorApplication.findById(doctorId);
        if (!doctor) {
            return res.status(404).json({ success: false, message: "Doctor not found" });
        }

        const fee = doctor.consultationFee || 500; // Default if not set

        // 4. Create Stripe PaymentIntent for embedded elements
        let paymentIntent;
        try {
            paymentIntent = await stripe.paymentIntents.create({
                amount: fee * 100,
                currency: "inr",
                payment_method_types: ["card"],
                metadata: { doctorId, userId, date, timeSlot, reason }
            });
        } catch (stripeError: any) {
            console.error("STRIPE INTENT ERROR:", stripeError.message);
            if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === "sk_test_placeholder") {
                paymentIntent = { 
                    id: "mock_intent_" + Date.now(), 
                    client_secret: "mock_secret_" + Date.now() 
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
            paymentStatus: "pending"
        });

        // Emit socket event for live tracking
        const io = req.app.get("io");
        io.to(doctorId).emit("slot_booked", {
            doctorId,
            date,
            timeSlot,
            patientName: req.user.name,
            bookingId: booking._id
        });

        return res.status(200).json({ 
            success: true, 
            booking, 
            clientSecret: paymentIntent.client_secret
        });

    } catch (error: any) {
        console.error("Booking Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

export const confirmPayment = async (req: Request, res: Response) => {
    try {
        const { paymentIntentId } = req.body;

        if (!paymentIntentId) {
            return res.status(400).json({ success: false, message: "Payment Intent ID is required" });
        }

        console.log("Attempting to confirm payment for Intent:", paymentIntentId);
        const booking = await DoctorBooking.findOneAndUpdate(
            { stripeSessionId: paymentIntentId },
            { paymentStatus: "paid" },
            { new: true }
        );

        if (!booking) {
            console.warn("No booking found with stripeSessionId:", paymentIntentId);
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        console.log("Successfully updated booking status to 'paid':", booking._id);

        // Check if consultation room already exists
        let consultation = await Consultation.findOne({ bookingId: booking._id });
        
        if (!consultation) {
            const random = crypto.randomBytes(16).toString("hex");
            const roomid = `consultation_${booking.doctorId}_${booking.userId}_${random}`;
            const scheduledAt = parseTimeSlot(booking.date, booking.timeSlot);
            
            consultation = await Consultation.create({
                doctorId: booking.doctorId,
                patientId: booking.userId,
                bookingId: booking._id,
                roomId: roomid,
                scheduledAt: scheduledAt,
                status: "scheduled"
            });
        }

        // Emit socket event for live doctor dashboard update
        const io = req.app.get("io");
        io.to(booking.doctorId.toString()).emit("payment_confirmed", {
            bookingId: booking._id,
            status: "paid"
        });

        return res.status(200).json({ success: true, booking, roomId: consultation.roomId });

    } catch (error: any) {
        console.error("Confirm Payment Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}