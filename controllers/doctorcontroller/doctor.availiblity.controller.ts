import { Request, Response } from "express";
import DoctorAvailability from "../../models/doctor.availbilty.model.js";
import { getAvailblitySlots } from "../../services/slot.service.js";
import { AuthRequest } from "../../types/authRequest.js";
import { DoctorApplication } from "../../models/doctor.model.js";

export const saveAvailability = async (req: AuthRequest, res: Response) => {
    try {
        const { weeklyavailability, dailyavailability, slotDuration } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const doctorProfile = await DoctorApplication.findOne({ userId });
        if (!doctorProfile) {
            return res.status(404).json({ message: "Doctor profile not found" });
        }

        const doctor_id = doctorProfile._id.toString();

        const availability = await DoctorAvailability.findOneAndUpdate(
            { doctor_id },
            {
                weeklyavailability,
                dailyavailability,
                slotDuration
            },
            { new: true, upsert: true }
        );

        return res.status(200).json({ 
            success: true,
            message: "Availability saved successfully", 
            availability 
        });

    } catch (error: any) {
        console.error("Error saving availability:", error);
        return res.status(500).json({ 
            success: false,
            message: "Internal server error",
            error: error.message 
        });
    }
};

export const getAvailabilityConfig = async (req: Request, res: Response) => {
    try {
        const { doctorId } = req.query;
        if (!doctorId) {
            return res.status(400).json({ success: false, message: "doctorId is required" });
        }

        const availability = await DoctorAvailability.findOne({ doctor_id: doctorId as string });
        
        return res.status(200).json({
            success: true,
            availability
        });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getAvailableSlots = async (req: Request, res: Response) => {
    try {
        const { doctorId, date } = req.query;

        if (!doctorId || !date) {
            return res.status(400).json({ 
                success: false, 
                message: "doctorId and date (YYYY-MM-DD) are required" 
            });
        }

        const slots = await getAvailblitySlots(doctorId as string, date as string);

        return res.status(200).json({
            success: true,
            slots
        });
    } catch (error: any) {
        console.error("Error fetching slots:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Internal server error" 
        });
    }
};