import {Consultation} from "../models/consultation.model.js";
import {Request, Response} from "express";
export const getConsultation = async (req: Request, res: Response) => {
    try {
        const { roomId } = req.params;
        const consultation = await Consultation.findOne({ roomId }).populate("bookingId");
            
        if (!consultation) {
            return res.status(404).json({ success: false, message: "Consultation not found" });
        }
        
        res.json({ success: true, consultation });
    } catch (error: any) {
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const completeConsultation = async (req: Request, res: Response) => {
    try {
        const { roomId } = req.params;
        const consultation = await Consultation.findOne({ roomId }).populate("bookingId");
            
        if (!consultation) {
            return res.status(404).json({ success: false, message: "Consultation not found" });
        }

        const now = new Date();
        if (consultation.scheduledAt && now < consultation.scheduledAt) {
            const booking = consultation.bookingId as any;
            const slotStr = booking?.timeSlot || "";
            return res.status(400).json({
                success: false,
                message: `You cannot mark this consultation as completed before its scheduled time (${slotStr}).`
            });
        }

        consultation.status = "completed";
        await consultation.save();
        
        res.json({ success: true, consultation });
    } catch (error: any) {
        res.status(500).json({ success: false, message: "Server error" });
    }
};