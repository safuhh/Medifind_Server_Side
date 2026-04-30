import { Request, Response } from "express";
import { User } from "../models/user.model.js";
import { SellerRequest } from "../models/sellerRequest.model.js";
import { getAddressFromCoords } from "../utils/geocode.js";
import { AuthRequest } from "../types/authRequest.js";

export const applyseller = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized user" });
    }

    const { shopName, licenseNumber, address, phone, lat, lng } = req.body;

    const existing = await SellerRequest.findOne({ userId });

    if (existing) {
      return res.status(400).json({
        message: `You already have a ${existing.status} request`,
      });
    }

    const parsedLat = Number(lat);
    const parsedLng = Number(lng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return res.status(400).json({ message: "Invalid location data" });
    }

    const geoData = await getAddressFromCoords(parsedLat, parsedLng);
    console.log("GEO DATA:", geoData);

    const request = new SellerRequest({
      userId,
      shopName,
      licenseNumber,
      address,
      phone,
      location: {
        address: geoData.shortName,
        fullAddress: geoData.fullAddress || "",
        lat: parsedLat,
        lng: parsedLng,
      },
    });
    await request.save();

    return res.status(201).json({
      message: "Seller request submitted successfully",
      request,
    });
  } catch (error) {
    console.log("ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
};



export const sellerDashboard = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "User not found in token" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "seller") {
      return res.status(403).json({ message: "Not a seller" });
    }

    const sellerinfo = await SellerRequest.findOne({ userId });

    if (!sellerinfo) {
      return res.status(404).json({ message: "Seller info not found" });
    }

    res.json({ sellerinfo });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server error" });
  }
};




export const updateSellerInfo = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { shopName, licenseNumber, address, phone, lat, lng } = req.body;

    const parsedLat = Number(lat);
    const parsedLng = Number(lng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return res.status(400).json({ message: "Invalid location data" });
    }

    const geoData = await getAddressFromCoords(parsedLat, parsedLng);

    const upload = await SellerRequest.findOneAndUpdate(
      { userId },
      {
        shopName,
        licenseNumber,
        address,
        phone,
        location: {
          address: geoData.shortName || address || "Unknown",
          fullAddress: geoData.fullAddress || "",
          lat: parsedLat,
          lng: parsedLng,
        },
      },
      { new: true },
    );

    if (!upload) {
      return res.status(404).json({ message: "Seller not found" });
    }

    res.json({ message: "Seller info updated", upload });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getCurrentSellerInfo = async (req: any, res: Response) => {
  try {
    console.log("USER:", req.user);

    const userId = req.user?.id;

    const seller = await SellerRequest.findOne({ userId });

    console.log("SELLER FOUND:", seller);

    if (!seller) {
      return res.status(404).json({
        message: "No seller request found for this user",
      });
    }

    return res.json(seller);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};