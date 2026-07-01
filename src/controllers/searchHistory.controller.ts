import { Response } from "express";
import { SearchHistory, SearchHistoryType } from "../models/searchHistory.model.js";
import mongoose from "mongoose";

// Save a new search history record
export const createSearchRecord = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const {
      medicineName,
      genericName,
      brandName,
      medicineDescription,
      dosageInformation,
      usageInstructions,
      sideEffects,
      warningsPrecautions,
      alternativeMedicines,
      nearbyPharmacyResults,
      searchLocation,
      availablePharmaciesFound,
      searchResultStatus,
      medicineCategory,
      searchQuery,
    } = req.body;

    if (!medicineName || !searchQuery) {
      return res.status(400).json({ success: false, message: "Medicine name and search query are required." });
    }

    // Check if the user searched for the exact same medicine name/query in the last 15 minutes, update timestamp instead of duplicate records
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const existingRecordQuery = {
      userId,
      searchQuery: searchQuery.trim(),
      createdAt: { $gte: fifteenMinutesAgo }
    };
    const existingRecord = await SearchHistory.findOne(existingRecordQuery as any);

    if (existingRecord) {
      existingRecord.timestamp = new Date();
      existingRecord.availablePharmaciesFound = availablePharmaciesFound || 0;
      existingRecord.searchResultStatus = searchResultStatus || "available";
      if (nearbyPharmacyResults) existingRecord.nearbyPharmacyResults = nearbyPharmacyResults;
      await existingRecord.save();
      return res.status(200).json({ success: true, searchRecord: existingRecord });
    }

    const searchRecord = new SearchHistory({
      userId,
      medicineName: medicineName.trim(),
      genericName,
      brandName,
      medicineDescription,
      dosageInformation,
      usageInstructions,
      sideEffects,
      warningsPrecautions,
      alternativeMedicines,
      nearbyPharmacyResults,
      searchLocation: searchLocation || "Global",
      availablePharmaciesFound: availablePharmaciesFound || 0,
      searchResultStatus: searchResultStatus || "available",
      medicineCategory,
      searchQuery: searchQuery.trim(),
    });

    await searchRecord.save();
    return res.status(201).json({ success: true, searchRecord });
  } catch (error: any) {
    console.error("Create Search History Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get user's search history with filtering, sorting, pagination, and query text search
export const getSearchHistory = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { category, status, isFavorite, q, sortBy } = req.query;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
    const skip = (page - 1) * limit;

    const filterQuery: Record<string, any> = { userId };

    if (category && category !== "") {
      filterQuery.medicineCategory = { $regex: new RegExp(`^${category}$`, "i") };
    }

    if (status && status !== "") {
      filterQuery.searchResultStatus = status;
    }

    if (isFavorite === "true") {
      filterQuery.isFavorite = true;
    }

    if (q && q.trim() !== "") {
      const searchRegex = new RegExp(q.trim(), "i");
      filterQuery.$or = [
        { medicineName: searchRegex },
        { genericName: searchRegex },
        { searchQuery: searchRegex },
        { brandName: searchRegex }
      ];
    }

    let sortOption: any = { timestamp: -1 }; // default: Newest
    if (sortBy === "oldest") {
      sortOption = { timestamp: 1 };
    } else if (sortBy === "alphabetical") {
      sortOption = { medicineName: 1 };
    } else if (sortBy === "pharmacies") {
      sortOption = { availablePharmaciesFound: -1 };
    }

    const searchRecords = await SearchHistory.find(filterQuery as any)
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    const total = await SearchHistory.countDocuments(filterQuery);

    return res.status(200).json({
      success: true,
      searchRecords,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error: any) {
    console.error("Get Search History Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Toggle Favorite Status
export const toggleFavoriteSearch = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const filter = { _id: id, userId };
    const record = await SearchHistory.findOne(filter as any);
    if (!record) {
      return res.status(404).json({ success: false, message: "Search history record not found." });
    }

    record.isFavorite = !record.isFavorite;
    await record.save();

    return res.status(200).json({ success: true, isFavorite: record.isFavorite, searchRecord: record });
  } catch (error: any) {
    console.error("Toggle Favorite Search Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a search history entry
export const deleteSearchRecord = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const filter = { _id: id, userId };
    const record = await SearchHistory.findOneAndDelete(filter as any);
    if (!record) {
      return res.status(404).json({ success: false, message: "Search history record not found." });
    }

    return res.status(200).json({ success: true, message: "Search history entry deleted successfully." });
  } catch (error: any) {
    console.error("Delete Search History Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
