import mongoose from "mongoose";
import { Medicine } from "../models/medicine.model.js";
import { SellerRequest } from "../models/sellerRequest.model.js";
import { Response } from "express";
import { AuthRequest } from "../types/authRequest.js";
import { createMedicineSchema } from "../validations/medicine.validation.js";

const safeJsonParse = (str: string) => {
  try {
    return str && typeof str === "string" ? JSON.parse(str) : str;
  } catch (e) {
    return null;
  }
};

const isValidImages = (files: any[]) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
  return files.every((file: any) => allowedMimeTypes.includes(file.mimetype));
};

export const createMedicine = async (req: AuthRequest, res: Response) => {
  try {
    const sellerRequest = await SellerRequest.findOne({
      userId: req.user.id,
      status: "approved",
    });
    if (!sellerRequest) {
      return res.status(403).json({
        success: false,
        message: "Only approved sellers can add medicines.",
      });
    }

    const { error } = createMedicineSchema.validate(req.body);
    if (error) {
      return res
        .status(400)
        .json({ success: false, message: error.details[0].message });
    }

    const {
      name,
      brand,
      category,
      unitWeight,
      manufacturer,
      stock,
      pricing,
      description,
      barcode,
      existingImageUrls,
      visibility,
    } = req.body;

    const parsedPricing = safeJsonParse(pricing) || {
      mrp: 0,
      sellingPrice: 0,
      offer: "",
    };
    const urls = safeJsonParse(existingImageUrls);
    let images: string[] = Array.isArray(urls) ? urls : [];

    if (req.files) {
      const files = req.files as any[];
      if (!isValidImages(files)) {
        return res.status(400).json({
          success: false,
          message: "Invalid file type. Only JPG, PNG and WEBP are allowed.",
        });
      }

      images = [...images, ...files.map((file: any) => file.path)];
    }

    const medicine = new Medicine({
      name,
      brand: brand || "Generic",
      category: category || "General",
      manufacturer: manufacturer || "Unknown",
      description,
      unitWeight,
      images,
      sellerId: req.user.id,
      barcode,
      stock: Number(stock) || 0,
      pricing: parsedPricing,
      visibility: visibility || "public",
    });

    await medicine.save();
    return res.status(201).json({ success: true, medicine });
  } catch (error: any) {
    console.error("Create Medicine Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getMedicines = async (req: AuthRequest, res: Response) => {
  try {
    const { search } = req.query;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
    const skip = (page - 1) * limit;

    const query: any = { sellerId: req.user.id, isActive: { $ne: false } };

    if (search && search !== "undefined" && search !== "") {
      const searchRegex = { $regex: String(search).trim(), $options: "i" };
      query.$or = [
        { name: searchRegex },
        { brand: searchRegex },
        { category: searchRegex },
      ];
    }

    const medicines = await Medicine.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Medicine.countDocuments(query);

    return res.json({
      success: true,
      medicines,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Get Medicines Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMedicine = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      brand,
      category,
      unitWeight,
      manufacturer,
      stock,
      pricing,
      description,
      barcode,
      existingImages,
      visibility,
    } = req.body;

    const parsedPricing = safeJsonParse(pricing);
    let updatedImages: string[] = existingImages
      ? Array.isArray(existingImages)
        ? [...existingImages]
        : [existingImages]
      : [];

    if (req.files) {
      const files = req.files as any[];
      if (!isValidImages(files)) {
        return res.status(400).json({
          success: false,
          message: "Invalid file type. Only JPG, PNG and WEBP are allowed.",
        });
      }

      updatedImages = [
        ...updatedImages,
        ...files.map((file: any) => file.path),
      ];
    }

    const updateData: any = {
      name,
      brand,
      category,
      unitWeight,
      manufacturer,
      stock: Number(stock),
      description,
      barcode,
      images: updatedImages,
      visibility,
    };
    if (parsedPricing) updateData.pricing = parsedPricing;

    const medicine = await Medicine.findOneAndUpdate(
      { _id: id, sellerId: req.user.id },
      updateData,
      { new: true },
    );

    if (!medicine)
      return res
        .status(404)
        .json({ success: false, message: "Medicine not found" });
    return res.json({ success: true, medicine });
  } catch (error: any) {
    console.error("Update Medicine Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteMedicine = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const medicine = await Medicine.findOneAndUpdate(
      { _id: id, sellerId: req.user.id },
      { isActive: false },
      { new: true },
    );
    if (!medicine)
      return res
        .status(404)
        .json({ success: false, message: "Medicine not found" });
    return res.json({ success: true, message: "Deleted successfully" });
  } catch (error: any) {
    console.error("Delete Medicine Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
