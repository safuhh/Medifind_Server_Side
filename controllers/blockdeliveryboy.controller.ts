import { User } from "../models/user.model.js";
import { Response } from "express";
import { AuthRequest } from "../types/authRequest.js";

export const getAllDeliveryBoys = async (req: AuthRequest, res: Response) => {
  try {
    const deliveryBoys = await User.find({ role: "delivery_boy" }).select("-password");

    return res.status(200).json({
      success: true,
      data: deliveryBoys,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const blockDeliveryBoy = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBlocked: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Delivery boy blocked successfully",
      data: user,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const unblockDeliveryBoy = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBlocked: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Delivery boy unblocked successfully",
      data: user,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ✏️ EDIT DELIVERY BOY
export const updateDeliveryBoy = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Delivery boy updated successfully",
      data: user,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
