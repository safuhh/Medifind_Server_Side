import { User } from "../../models/user.model.js";
import { Response } from "express";
import { AuthRequest } from "../../types/authRequest.js";

// --- Internal Helpers ---
const getUsersByRoleHelper = async (role: string, res: Response, dataKey: string = "data") => {
  try {
    const users = await User.find({ role }).select("-password");
    return res.status(200).json({ success: true, [dataKey]: users });
  } catch (error: any) {
    console.error(`GET_USERS_ERROR for role ${role}:`, error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

const toggleBlockHelper = async (id: string, isBlocked: boolean, res: Response, dataKey: string = "data") => {
  try {
    if (!id) return res.status(400).json({ success: false, message: "No ID provided" });

    // Use save() for doctors to preserve old behavior, but findByIdAndUpdate is cleaner.
    // We'll just use findByIdAndUpdate for all to be consistent.
    const user = await User.findByIdAndUpdate(
      id,
      { isBlocked },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const action = isBlocked ? "blocked" : "unblocked";
    // Send both message formats for compatibility
    return res.status(200).json({
      success: true,
      message: `User ${action} successfully`, // For seller/delivery
      [dataKey]: user,
    });
  } catch (error: any) {
    console.error(`TOGGLE_BLOCK_ERROR:`, error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// --- Delivery Boys ---
export const getAllDeliveryBoys = (req: AuthRequest, res: Response) => getUsersByRoleHelper("delivery_boy", res);
export const blockDeliveryBoy = (req: AuthRequest, res: Response) => toggleBlockHelper(req.params.id as string, true, res);
export const unblockDeliveryBoy = (req: AuthRequest, res: Response) => toggleBlockHelper(req.params.id as string, false, res);
export const updateDeliveryBoy = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ success: false, message: "Delivery boy not found" });

    return res.status(200).json({ success: true, message: "Delivery boy updated successfully", data: user });
  } catch (error) {
    console.error("UPDATE_DELIVERY_BOY_ERROR:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// --- Doctors ---
export const getAllDoctors = (req: AuthRequest, res: Response) => getUsersByRoleHelper("doctor", res, "doctors");
export const blockDoctor = (req: AuthRequest, res: Response) => toggleBlockHelper(req.params.doctorId as string, true, res, "doctor");
export const unblockDoctor = (req: AuthRequest, res: Response) => toggleBlockHelper(req.params.doctorId as string, false, res, "doctor");

// --- Sellers ---
export const getAllSellers = (req: AuthRequest, res: Response) => getUsersByRoleHelper("seller", res);
export const blockSeller = (req: AuthRequest, res: Response) => toggleBlockHelper(req.params.id as string, true, res);
export const unblockSeller = (req: AuthRequest, res: Response) => toggleBlockHelper(req.params.id as string, false, res);
