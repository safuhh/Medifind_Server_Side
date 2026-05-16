import { Request, Response } from "express";
import { getAvailblitySlots } from "../services/slot.service.js";

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
