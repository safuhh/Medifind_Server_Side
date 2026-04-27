import { Request, Response } from "express";
import { User } from "../models/user.model.js";
import { SellerRequest } from "../models/sellerRequest.model.js";
import { sellerApplySchema } from "../validations/seller.validation.js";

// apply for seller
export const applyseller = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "User not found in token" });
    }

    const existing = await SellerRequest.findOne({
      userId,
      status: { $in: ["pending", "approved","rejected"] },
    });

    if (existing) {
      return res.status(400).json({
        message: "You already applied",
      });
    }

    const { shopName, licenseNumber, address, phone } = req.body;

    const request = await SellerRequest.create({
      userId,
      shopName,
      licenseNumber,
      address,
      phone,
    });

    return res.status(201).json({
      message: "Seller request submitted",
      request,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};