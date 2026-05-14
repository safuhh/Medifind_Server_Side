import {Consultation} from "../models/consultation.model.js";
import {Request, Response} from "express";
export const getConsultation = async (req: Request, res: Response) => {
    try {
        const { roomId } = req.params;
        const consultation = await Consultation.findOne({ roomId });
            
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
        const consultation = await Consultation.findOneAndUpdate(
            { roomId },
            { status: "completed" },
            { new: true }
        );
            
        if (!consultation) {
            return res.status(404).json({ success: false, message: "Consultation not found" });
        }
        
        res.json({ success: true, consultation });
    } catch (error: any) {
        res.status(500).json({ success: false, message: "Server error" });
    }
};