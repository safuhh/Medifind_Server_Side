import { Request, Response } from "express";
import { DoctorApplication } from "../models/doctor.model.js";
export const getDoctorsBySpecialization = async (req: Request, res: Response) => {
  try {
    const { specialization } = req.query;
    const doctors = await DoctorApplication.find({
      ...(specialization ? { specialization } : {}),
      status: "approved",
    }).populate("userId", "-password");
    res.json({ success: true, doctors });
  } catch (error: any) {
    console.error("Error fetching doctor applications:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
