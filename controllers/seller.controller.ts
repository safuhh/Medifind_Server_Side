import { Request, Response } from "express";
import { User } from "../models/user.model.js";
import { SellerRequest } from "../models/sellerRequest.model.js";
import { getAddressFromCoords } from "../utils/geocode.js";
import { Medicine } from "../models/medicine.model.js";
import mongoose from "mongoose";
export const applyseller = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized user" });
    }

    const user = await User.findById(userId); 

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.role === "admin" || user.role === "delivery_boy" || user.role === "doctor") {
  return res.status(403).json({
    message: "Admins,doctors and delivery boys cannot apply for seller",
  });
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

    const sellerObjectId = new mongoose.Types.ObjectId(userId);
    console.log(">>> DASHBOARD_QUERY. SellerID:", userId);

    const sellerinfo = await SellerRequest.findOne({ userId });
    if (!sellerinfo) {
      return res.status(404).json({ message: "Seller info not found" });
    }

    //  Count total unique medicine documents for this seller
    const totalProducts = await Medicine.countDocuments({ 
      sellerId: sellerObjectId, 
      isActive: { $ne: false } 
    });

    // Count products that have 0 or negative stock
    const outOfStockCount = await Medicine.countDocuments({ 
      sellerId: sellerObjectId, 
      isActive: { $ne: false },
      stock: { $lte: 0 }
    });

    //  Calculate total physical units across all medicines
    const stockStats = await Medicine.aggregate([
      { $match: { sellerId: sellerObjectId, isActive: { $ne: false } } },
      { $group: { _id: null, totalStock: { $sum: "$stock" } } }
    ]);
    const totalStock = stockStats.length > 0 ? stockStats[0].totalStock : 0;

    //  Get products that are running low (between 1 and 9 units)
    const lowStockProducts = await Medicine.find({
      sellerId: sellerObjectId,
      isActive: { $ne: false },
      stock: { $gt: 0, $lt: 10 }
    }).select("name stock").limit(10).lean();

    console.log(`>>> DASHBOARD_STATS. Products: ${totalProducts}, Stock: ${totalStock}, Low: ${lowStockProducts.length}`);

    res.json({ 
      sellerinfo,
      totalProducts,
      totalStock,
      outOfStockCount,
      lowStockProducts
    });
  } catch (error) {
    console.error(" DASHBOARD_ERROR:", error);
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
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "No user ID in request" });
    }

    const seller = await SellerRequest.findOne({ userId }).lean();

    console.log(" SELLER_FOUND_IN_DB:", seller ? seller.shopName : "NONE");

    // Return 200 even if null, so the frontend doesn't throw an Axios 404 error
    return res.status(200).json({ success: true, seller: seller || null });

  } catch (err: any) {
    console.error(" GET_CURRENT_SELLER_ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};