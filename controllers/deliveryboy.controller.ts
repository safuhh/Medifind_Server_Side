import { Request, Response } from "express";
import { DeliveryBoy } from "../models/deliveryRequste.model.js";
import { getAddressFromCoords } from "../utils/geocode.js";
import { AuthRequest } from "../types/authRequest.js";
import {
  applyDeliveryBoySchema,
  updateDeliveryBoySchema,
} from "../validations/deliveryBoy.validation.js";
import { User } from "../models/user.model.js"; 

export const applyDeliveryBoy = async (req: AuthRequest, res: Response) => {
  try {
    const { error } = applyDeliveryBoySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized user" });
    }

    const user = await User.findById(userId); 

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.role === "admin" || user.role === "seller") {
  return res.status(403).json({
    message: "Admins and Sellers cannot apply for Delivery Boy",
  });
}

    const {
      name,
      phone,
      vehicleType,
      vehicleNumber,
      address,
      aadhaarNumber,
      lat,
      lng,
    } = req.body;
    
    const aadhaarImage = req.file ? req.file.path : req.body.aadhaarImage;

    const existing = await DeliveryBoy.findOne({ userId });

    if (existing) {
      return res.status(400).json({
        message: `You already have a ${existing.status} request`,
      });
    }

    const vehicleExists = await DeliveryBoy.findOne({ vehicleNumber });

    if (vehicleExists) {
      return res.status(400).json({
        message: "Vehicle already registered",
      });
    }

    const parsedLat = Number(lat);
    const parsedLng = Number(lng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return res.status(400).json({
        message: "Invalid location coordinates",
      });
    }

    const geoData = await getAddressFromCoords(parsedLat, parsedLng);

    const maskedAadhaar = aadhaarNumber
      ? aadhaarNumber.replace(/\d(?=\d{4})/g, "X")
      : "";

    const deliveryBoy = await DeliveryBoy.create({
      userId,
      name,
      phone,
      vehicleType,
      vehicleNumber,
      address,
      location: {
        address: geoData.shortName,
        fullAddress: geoData.fullAddress || "",
        lat: parsedLat,
        lng: parsedLng,
      },
      kyc: {
        aadhaarNumber: maskedAadhaar,
        aadhaarImage,
      },
    });

    return res.status(201).json({
      message: "Delivery Boy request submitted successfully",
      deliveryBoy,
    });

  } catch (error) {
    console.log("ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const deliveryBoyDashboard = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized user" });
    }

    if (req.user.role !== "delivery_boy") {
      return res.status(403).json({ message: "Not a delivery boy" });
    }

    const deliveryBoy = await DeliveryBoy.findOne({ userId }).populate(
      "currentOrderId",
    );

    if (!deliveryBoy) {
      return res.status(404).json({ message: "Delivery Boy not found" });
    }

    if (deliveryBoy.status !== "approved") {
      return res.status(403).json({
        message: "Your account is not approved yet",
      });
    }

    return res.json({
      deliveryBoy,
      message: "Dashboard loaded",
    });
  } catch (error) {
    console.log("ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateDeliveryBoyInfo = async (req: any, res: Response) => {
  try {
    const { error } = updateDeliveryBoySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: error.details[0].message,
      });
    }

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized user" });
    }

    if (req.user.role !== "delivery_boy") {
      return res.status(403).json({ message: "Not a delivery boy" });
    }

    const existing = await DeliveryBoy.findOne({ userId });

    if (!existing) {
      return res.status(404).json({ message: "Delivery Boy not found" });
    }

    if (existing.status !== "approved") {
      return res.status(403).json({
        message: "Account not approved yet",
      });
    }

    const { name, phone, vehicleType, vehicleNumber } = req.body;

    const updateData: any = {};

    if (name) updateData.name = name.trim();
    if (phone) updateData.phone = phone.trim();
    if (vehicleType) updateData.vehicleType = vehicleType;
    if (vehicleNumber) updateData.vehicleNumber = vehicleNumber.trim();

    const updated = await DeliveryBoy.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true },
    );

    return res.json({
      deliveryBoy: updated,
      message: "Delivery Boy info updated",
    });
  } catch (error) {
    console.log("ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getcurrentDeliveryBoyInfo = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized user" });
    }
    if (req.user.role !== "delivery_boy") {
      return res.status(403).json({ message: "Not a delivery boy" });
    }

    const deliveryBoy = await DeliveryBoy.findOne({ userId });

    if (!deliveryBoy) {
      return res.status(404).json({ message: "Delivery Boy not found" });
    }
    return res.json({ deliveryBoy });
  } catch (error) {
    console.log("ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
