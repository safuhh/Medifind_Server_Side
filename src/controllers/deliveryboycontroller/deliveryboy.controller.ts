import { Request, Response } from "express";
import { DeliveryBoy } from "../../models/deliveryRequste.model.js";
import { getAddressFromCoords } from "../../utils/geocode.js";
import { AuthRequest } from "../../types/authRequest.js";
import {
  applyDeliveryBoySchema,
  updateDeliveryBoySchema,
} from "../../validators/deliveryBoy.validation.js";
import { User } from "../../models/user.model.js";

import { SellerRequest } from "../../models/sellerRequest.model.js";
import DeliveryDetails from "../../models/deliveryDetails.model.js";
import Stripe from "stripe";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "sk_test_placeholder",
);

export const applyDeliveryBoy = async (req: AuthRequest, res: Response) => {
  try {
    if (req.file) {
      req.body.aadhaarImage = req.file.path;
    }

    const { error } = applyDeliveryBoySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error?.details?.[0]?.message });
    }

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized user" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (
      user.role === "admin" ||
      user.role === "seller" ||
      user.role === "doctor"
    ) {
      return res.status(403).json({
        message: "Admins,sellers and doctors cannot apply for Delivery Boy",
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

    // OCR removed. We rely on frontend normal validation and manual approval.
    const ocrStatus = "pending";
    const ocrExtractedNumber = "";

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
        ocrStatus: ocrStatus,
        ocrExtractedNumber: ocrExtractedNumber,
        isVerified: true,
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


export const updateDeliveryBoyInfo = async (req: any, res: Response) => {
  try {
    const { error } = updateDeliveryBoySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: error?.details?.[0]?.message,
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

    const { name, phone, vehicleType, vehicleNumber, address, lat, lng } = req.body;

    const updateData: any = {};

    if (name) updateData.name = name.trim();
    if (phone) updateData.phone = phone.trim();
    if (vehicleType) updateData.vehicleType = vehicleType;
    if (vehicleNumber) updateData.vehicleNumber = vehicleNumber.trim();
    if (address) updateData.address = address.trim();

    if (lat !== undefined && lng !== undefined) {
      const parsedLat = Number(lat);
      const parsedLng = Number(lng);
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        const geoData = await getAddressFromCoords(parsedLat, parsedLng);
        updateData.location = {
          address: geoData.shortName,
          fullAddress: geoData.fullAddress || "",
          lat: parsedLat,
          lng: parsedLng,
        };
      }
    }

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
    if (req.user?.role !== "delivery_boy") {
      return res.status(403).json({ message: "Not a delivery boy" });
    }

    const deliveryBoy = await DeliveryBoy.findOne({ userId })
      .populate({
        path: "currentOrderId",
        model: "Order",
        populate: [
          { path: "deliveryDetailsId", model: "DeliveryDetails" },
          { path: "userId", select: "name email phone location", model: "User" },
          { path: "items.medicineId", model: "Medicine" },
          {
            path: "items.sellerId",
            model: "User",
            select: "name phone location",
          },
        ],
      })
      .lean();

    if (!deliveryBoy) {
      return res.status(404).json({ message: "Delivery Boy not found" });
    }

    if (deliveryBoy.currentOrderId) {
      const order = deliveryBoy.currentOrderId as any;
      if (order.items) {
        for (const item of order.items) {
          if (item.sellerId && item.sellerId._id) {
            const sellerReq = await SellerRequest.findOne({
              userId: item.sellerId._id,
            }).lean();
            if (sellerReq) {
              item.sellerShop = {
                shopName: sellerReq.shopName,
                address: sellerReq.address,
                phone: sellerReq.phone,
                location: sellerReq.location,
              };
            }
          }
        }
      }
    }

    return res.json({ deliveryBoy });
  } catch (error) {
    console.log("ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

