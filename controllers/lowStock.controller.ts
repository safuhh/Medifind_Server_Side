import { Request, Response } from "express";
import { Medicine } from "../models/medicine.model.js";
import mongoose from "mongoose";

export const getLowStocks = async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    let query: any = { stock: { $lt: 10 }, isActive: { $ne: false } };

    // If seller, only show their stocks. If admin, show all.
    if (userRole === "seller") {
      query.sellerId = new mongoose.Types.ObjectId(userId);
    } else if (userRole !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const medicines = await Medicine.find(query).populate("sellerId", "name email");

    res.status(200).json({ 
      success: true,
      medicines 
    });
  } catch (error: any) {
    console.error("GET_LOW_STOCKS_ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};