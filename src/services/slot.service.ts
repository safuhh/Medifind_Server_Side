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
    const morning = availability.dailyavailability?.morning;
    const morningSlots = morning?.from && morning?.to
        ? generateSlots(
            morning.from,
            morning.to,
            availability.slotDuration || 15
        )
        : [];

    // Generate evening slots
    const evening = availability.dailyavailability?.evening;
    const eveningSlots = evening?.from && evening?.to
        ? generateSlots(
            evening.from,
            evening.to,
            availability.slotDuration || 15
        )
        : [];

    const allBaseSlots = Array.from(new Set([...morningSlots, ...eveningSlots]));

    // Filter out past slots if the date is today
    const isToday = dayjs(date).isSame(dayjs(), "day");
    let filteredSlots = allBaseSlots;

    if (isToday) {
        const now = dayjs();
        filteredSlots = allBaseSlots.filter(slot => {
            const timeParts = slot.split(":");
            if (!timeParts[0] || !timeParts[1]) return false;
            const hours = parseInt(timeParts[0]);
            const minutes = parseInt(timeParts[1]);
            
            const slotTime = dayjs(date).startOf("day").hour(hours).minute(minutes);
            return slotTime.isAfter(now);
        });
    }

    // Filter out already booked slots
    const bookedSlots = await DoctorBooking.find({
        doctorId,
        date: dayjs(date).startOf("day").toDate(),
        status: { $ne: "cancelled" },
        paymentStatus: "paid"
    }).select("timeSlot");

    const bookedTimeSlots = bookedSlots.map(booking => booking.timeSlot);

    return filteredSlots.filter(slot => !bookedTimeSlots.includes(slot));
}
