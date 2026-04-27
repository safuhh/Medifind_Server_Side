import { Request, Response } from "express";
import { User } from "../models/user.model.js";
import { SellerRequest } from "../models/sellerRequest.model.js";
export const approveseller = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const request = await SellerRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }
    request.status = "approved";
    await request.save();
    await User.findByIdAndUpdate(request.userId, { role: "seller" });
    res.json({ message: "Seller request approved" });
  } catch (error) {
    console.error("Error in approveseller:", error);
    res.status(500).json({ message: "Server error" });
  }
};
export const getSellerRequests = async (req: Request, res: Response) => {
  try {
    const requests = await SellerRequest.find().sort({ createdAt: -1 });
  console.log("REQUESTS:", requests);
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};