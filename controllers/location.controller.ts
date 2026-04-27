import { Response } from "express";
import { User } from "../models/user.model.js";

export const updatelocation = async (req: any, res: Response) => {
  try {
    const userId = req.body.userId;
    const { lat, lng } = req.body;

    // 🔥 validation
    if (
      typeof lat !== "number" ||
      typeof lng !== "number"
    ) {
      return res.status(400).json({
        message: "Invalid lat or lng",
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        lat,
        lng,
        location: {
          type: "Point",
          coordinates: [lng, lat], // 🔥 MOST IMPORTANT
        },
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json({
      message: "Location updated",
      location: user.location,
    });

  } catch (error) {
    console.error("Error in updatelocation:", error);
    res.status(500).json({ message: "Server error" });
  }
};