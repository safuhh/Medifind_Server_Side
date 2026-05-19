import mongoose from "mongoose";
import { Medicine } from "../models/medicine.model.js";
import { Response, Request } from "express";
import { calculateDistance } from "../utils/geocode.js";

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

    // Process results to add distance and format shop object
    const results = medicines.map((med: any) => {
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

    if (lat && lng) {
      results.sort(
        (a, b) =>
          (a.shop?.distance ?? Infinity) - (b.shop?.distance ?? Infinity),
      );
    }

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

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid medicine ID" });
    }

    const pipeline: any[] = [
      {
        $match: { _id: new mongoose.Types.ObjectId(id), isActive: true },
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
