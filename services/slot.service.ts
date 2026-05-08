import DoctorAvailability from "../models/doctor.availbilty.model.js"
import { generateSlots } from "../utils/generateSlots.js";
import { DoctorBooking } from "../models/doctor.booking.model.js";
import dayjs from "dayjs";

export const getAvailblitySlots = async (
    doctorId :string,
    date :string
)=>{
    const dayname = dayjs(date).format("dddd").toLowerCase();
    const availability = await DoctorAvailability.findOne({
        doctor_id: doctorId
    })

    if(!availability){
        return []
    }

    // Check if the specific day is enabled in weekly availability
    const isDayAvailable = (availability.weeklyavailability as any)[dayname];

    if(!isDayAvailable){
        return []
    }

    // Generate morning slots
    const morningSlots = availability.dailyavailability.morning.from && availability.dailyavailability.morning.to
        ? generateSlots(
            availability.dailyavailability.morning.from,
            availability.dailyavailability.morning.to,
            availability.slotDuration || 15
        )
        : [];

    // Generate evening slots
    const eveningSlots = availability.dailyavailability.evening.from && availability.dailyavailability.evening.to
        ? generateSlots(
            availability.dailyavailability.evening.from,
            availability.dailyavailability.evening.to,
            availability.slotDuration || 15
        )
        : [];

    const allBaseSlots = [...morningSlots, ...eveningSlots];

    // Filter out past slots if the date is today
    const isToday = dayjs(date).isSame(dayjs(), "day");
    let filteredSlots = allBaseSlots;

    if (isToday) {
        const now = dayjs();
        filteredSlots = allBaseSlots.filter(slot => {
            // Parse slot time (e.g. "10:00 AM")
            const parts = slot.split(" ");
            const timeParts = parts[0].split(":");
            let hours = parseInt(timeParts[0]);
            const minutes = parseInt(timeParts[1]);
            const modifier = parts[1];
            
            if (modifier === "PM" && hours < 12) hours += 12;
            if (modifier === "AM" && hours === 12) hours = 0;
            
            const slotTime = dayjs(date).startOf("day").add(hours, "hour").add(minutes, "minute");
            return slotTime.isAfter(now);
        });
    }

    // Filter out already booked slots
    const bookedSlots = await DoctorBooking.find({
        doctorId,
        date: dayjs(date).startOf("day").toDate(),
        status: { $ne: "cancelled" }
    }).select("timeSlot");

    const bookedTimeSlots = bookedSlots.map(booking => booking.timeSlot);

    return filteredSlots.filter(slot => !bookedTimeSlots.includes(slot));
}