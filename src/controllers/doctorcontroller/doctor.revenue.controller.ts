import { Response } from "express";
import { AuthRequest } from "../../types/authRequest.js";
import { DoctorBooking } from "../../models/doctor.booking.model.js";
import { DoctorApplication } from "../../models/doctor.model.js";
import dayjs from "dayjs";

export const getDoctorRevenueDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    console.log(`[REVENUE] Fetching for User ID: ${userId}`);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // 1. Find Doctor Profile
    const doctor = await DoctorApplication.findOne({ userId });
    if (!doctor) {
      console.error(`[REVENUE] Doctor profile NOT FOUND for user: ${userId}`);
      return res.status(404).json({ message: "Doctor profile not found" });
    }

    const doctorId = doctor._id;
    console.log(`[REVENUE] Found Doctor Profile: ${doctorId}`);

    // 2. Fetch all non-cancelled bookings for this doctor
    // We fetch all and filter in JS to be 100% sure about the logic
    const allBookings = await DoctorBooking.find({
      doctorId: doctorId,
      status: { $ne: "cancelled" }
    });

    console.log(`[REVENUE] Found ${allBookings.length} total active bookings`);

    const now = dayjs();
    const startOfToday = now.startOf("day");
    const startOfThisMonth = now.startOf("month");
    const startOfThisYear = now.startOf("year");

    let todayRev = 0;
    let monthRev = 0;
    let yearRev = 0;

    allBookings.forEach((booking: any) => {
      const amount = Number(booking.amount) || 0;
      const bookingDate = booking.createdAt || booking.date; // Fallback to date
      const createdAt = dayjs(bookingDate);

      console.log(`[REVENUE] Processing Booking: ID=${booking._id}, Amount=${amount}, Date=${createdAt.format()}`);

      if (createdAt.isAfter(startOfToday) || createdAt.isSame(startOfToday, 'day')) {
        todayRev += amount;
      }
      if (createdAt.isAfter(startOfThisMonth) || createdAt.isSame(startOfThisMonth, 'month')) {
        monthRev += amount;
      }
      if (createdAt.isAfter(startOfThisYear) || createdAt.isSame(startOfThisYear, 'year')) {
        yearRev += amount;
      }
    });

    const totals = {
      today: todayRev,
      month: monthRev,
      year: yearRev,
      totalBookings: allBookings.length
    };

    console.log(`[REVENUE] Final Totals calculated:`, totals);

    return res.json({
      success: true,
      totals,
      debug: {
        doctorId: doctorId.toString(),
        count: allBookings.length
      }
    });
  } catch (error: any) {
    console.error("[REVENUE CRITICAL ERROR]:", error);
    return res.status(500).json({ 
      message: "Server error", 
      error: error.message 
    });
  }
};

export const todayEarnings = getDoctorRevenueDashboard;
export const monthlyEarnings = getDoctorRevenueDashboard;
export const earlyearnings = getDoctorRevenueDashboard;
