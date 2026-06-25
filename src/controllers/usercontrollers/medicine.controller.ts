import mongoose from "mongoose";
import { Medicine } from "../../models/medicine.model.js";
import { SellerRequest } from "../../models/sellerRequest.model.js";
import { Response, Request } from "express";
import { AuthRequest } from "../../types/authRequest.js";
import { createMedicineSchema } from "../../validators/medicine.validation.js";
import { calculateDistance } from "../../utils/geocode.js";

const getDistance = (lat: any, lng: any, location: any) => {
  if (lat && lng && location?.lat != null && location?.lng != null) {
    return calculateDistance(
      Number(lat),
      Number(lng),
      Number(location.lat),
      Number(location.lng),
    );
  }
  return null;
};

// the user can show the all medicine
export const getAllMedicines = async (req: Request, res: Response) => {
  try {
    const { search, lat, lng } = req.query;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
    const skip = (page - 1) * limit;
    console.log("GET_ALL_STABLE_HIT:", { search, lat, lng });

    const userRole = (req as any).user?.role;
    const isDoctor = userRole === "doctor";

    const pipeline: any[] = [
      {
        $match: {
          isActive: { $ne: false },
          ...(isDoctor ? {} : { visibility: { $ne: "restricted" } }),
        },
      },
      {
        $lookup: {
          from: "sellerrequests",
          let: { seller_id: "$sellerId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$userId", "$$seller_id"] },
                    { $eq: ["$status", "approved"] }
                  ]
                }
              }
            }
          ],
          as: "shop",
        },
      },
      {
        $unwind: {
          path: "$shop",
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    if (search && search !== "undefined" && search !== "") {
      const searchRegex = { $regex: String(search).trim(), $options: "i" };
      pipeline.push({
        $match: {
          $or: [
            { name: searchRegex },
            { brand: searchRegex },
            { category: searchRegex },
            { manufacturer: searchRegex },
            { "shop.shopName": searchRegex },
          ],
        },
      });
    }

    if (req.query.categories && typeof req.query.categories === "string" && req.query.categories.trim() !== "") {
      const catArray = req.query.categories.split(",").flatMap(c => {
        const cat = c.trim().toLowerCase();
        const matches = [new RegExp(`^${cat}$`, "i")];
        
        // Handle legacy/inconsistent database values
        if (cat === "pain relief") matches.push(new RegExp(`^pain$`, "i"));
        if (cat === "antibiotics") matches.push(new RegExp(`^antibiotic$`, "i"));
        if (cat === "other") {
          matches.push(new RegExp(`^syrup$`, "i"));
          matches.push(new RegExp(`^tablet$`, "i"));
        }
        
        return matches;
      });

      pipeline.push({
        $match: { category: { $in: catArray } }
      });
    }

    const hasLocation = lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng));

    if (hasLocation) {
      pipeline.push({ $sort: { createdAt: -1 } });

      const allMedicines = await Medicine.aggregate(pipeline);

      const MAX_DISTANCE_KM = 100;

      let results = allMedicines.map((med: any) => {
        const shop = med.shop;
        const distance = getDistance(lat, lng, shop?.location);
        return {
          ...med,
          shop: shop
            ? {
                name: shop.shopName,
                address: shop.address,
                location: shop.location,
                distance:
                  distance !== null && !isNaN(distance)
                    ? Number(distance.toFixed(2))
                    : null,
              }
            : null,
        };
      });

      results = results.filter(
        (med: any) => med.shop?.distance === null || med.shop?.distance <= MAX_DISTANCE_KM
      );

      results.sort(
        (a: any, b: any) =>
          (a.shop?.distance ?? Infinity) - (b.shop?.distance ?? Infinity)
      );

      const total = results.length;
      const paginatedResults = results.slice(skip, skip + limit);

      return res.status(200).json({
        success: true,
        medicines: paginatedResults,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } else {
      pipeline.push({ $sort: { createdAt: -1 } });
      pipeline.push({
        $facet: {
          medicines: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: "count" }],
        },
      });

      const [aggregationResult] = await Medicine.aggregate(pipeline);
      const medicines = aggregationResult.medicines || [];
      const total = aggregationResult.totalCount[0]?.count || 0;

      const results = medicines.map((med: any) => {
        const shop = med.shop;
        return {
          ...med,
          shop: shop
            ? {
                name: shop.shopName,
                address: shop.address,
                location: shop.location,
                distance: null,
              }
            : null,
        };
      });

      return res.status(200).json({
        success: true,
        medicines: results,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    }
  } catch (error: any) {
    console.error("CRITICAL_GET_ALL_ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const getMedicineById = async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.query;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id as string)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid medicine ID" });
    }

    const pipeline: any[] = [
      {
        $match: { _id: new mongoose.Types.ObjectId(id as string), isActive: true },
      },
      {
        $lookup: {
          from: "sellerrequests",
          let: { seller_id: "$sellerId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$userId", "$$seller_id"] },
                    { $eq: ["$status", "approved"] }
                  ]
                }
              }
            }
          ],
          as: "shop",
        },
      },
      {
        $unwind: {
          path: "$shop",
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    const medicines = await Medicine.aggregate(pipeline);
    if (!medicines.length)
      return res.status(404).json({ message: "Medicine not found" });

    const med = medicines[0];
    const shop = med.shop;
    const distance = getDistance(lat, lng, shop?.location);

    return res.status(200).json({
      success: true,
      medicine: {
        ...med,
        shop: shop
          ? {
              name: shop.shopName,
              address: shop.address,
              location: shop.location,
              phone: shop.phone,
              licenseNumber: shop.licenseNumber,
              distance:
                distance !== null && !isNaN(distance)
                  ? Number(distance.toFixed(2))
                  : null,
            }
          : null,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

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
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const sellerRequest = await SellerRequest.findOne({
      userId,
      status: "approved",
    });
    if (!sellerRequest) {
      return res.status(403).json({
        success: false,
        message: "Only approved sellers can add medicines.",
      });
    }

    const { error } = createMedicineSchema.validate(req.body, { allowUnknown: true });
    if (error) console.error('Medicine Validation Error:', error.details?.[0]?.message);
    if (error) {
      return res
        .status(400)
        .json({ success: false, message: error?.details?.[0]?.message });
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
      sellerId: userId,
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

export const getSellerMedicines = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { search } = req.query;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
    const skip = (page - 1) * limit;

    const query: any = { sellerId: userId, isActive: { $ne: false } };

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
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
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

    const medicine = await (Medicine as any).findOneAndUpdate(
      { _id: id, sellerId: userId },
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
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { id } = req.params;
    const medicine = await (Medicine as any).findOneAndUpdate(
      { _id: id, sellerId: userId },
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
