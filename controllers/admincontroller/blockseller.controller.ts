import { User } from "../../models/user.model.js";
import { Response } from "express";
import { AuthRequest } from "../../types/authRequest.js";

export const getAllSellers = async (req: AuthRequest, res: Response) => {
  try {
    const sellers = await User.find({ role: "seller" }).select("-password");

    return res.status(200).json({
      success: true,
      data: sellers,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const blockSeller = async (req: AuthRequest, res: Response) => {
  try {
    const seller = await User.findByIdAndUpdate(
      req.params.id,
      { isBlocked: true },
      { new: true }
    );

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Seller blocked successfully",
      data: seller,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const unblockSeller = async (req: AuthRequest, res: Response) => {
  try {
    const seller = await User.findByIdAndUpdate(
      req.params.id,
      { isBlocked: false },
      { new: true }
    );

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Seller unblocked successfully",
      data: seller,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};