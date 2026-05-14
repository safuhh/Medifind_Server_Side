import { Response } from "express";
import { Order } from "../models/order.model.js";
import mongoose from "mongoose";
import { AuthRequest } from "../types/authRequest.js";

export const getSellerEarnings = async (req: AuthRequest, res: Response) => {
  try {
    const sellerId = req.user?.id;
    if (!sellerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const sellerObjectId = new mongoose.Types.ObjectId(sellerId);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfThisYear = new Date(now.getFullYear(), 0, 1);

    const earningsData = await Order.aggregate([
      {
        $match: {
          paymentStatus: "paid",
          "items.sellerId": sellerObjectId
        }
      },
      {
        $unwind: "$items"
      },
      {
        $match: {
          "items.sellerId": sellerObjectId
        }
      },
      {
        $facet: {
          today: [
            { $match: { createdAt: { $gte: startOfToday } } },
            { 
              $group: { 
                _id: null, 
                earnings: { $sum: { $multiply: ["$items.sellerEarning", "$items.quantity"] } },
                orders: { $addToSet: "$_id" }
              } 
            },
            {
              $project: {
                _id: 0,
                earnings: { $ifNull: ["$earnings", 0] },
                count: { $size: { $ifNull: ["$orders", []] } }
              }
            }
          ],
          thisMonth: [
            { $match: { createdAt: { $gte: startOfThisMonth } } },
            { 
              $group: { 
                _id: null, 
                earnings: { $sum: { $multiply: ["$items.sellerEarning", "$items.quantity"] } },
                orders: { $addToSet: "$_id" }
              } 
            },
            {
              $project: {
                _id: 0,
                earnings: { $ifNull: ["$earnings", 0] },
                count: { $size: { $ifNull: ["$orders", []] } }
              }
            }
          ],
          thisYear: [
            { $match: { createdAt: { $gte: startOfThisYear } } },
            { 
              $group: { 
                _id: null, 
                earnings: { $sum: { $multiply: ["$items.sellerEarning", "$items.quantity"] } },
                orders: { $addToSet: "$_id" }
              } 
            },
            {
              $project: {
                _id: 0,
                earnings: { $ifNull: ["$earnings", 0] },
                count: { $size: { $ifNull: ["$orders", []] } }
              }
            }
          ]
        }
      }
    ]);

    const result = earningsData[0];

    const today = result.today.length > 0 ? result.today[0] : { earnings: 0, count: 0 };
    const thisMonth = result.thisMonth.length > 0 ? result.thisMonth[0] : { earnings: 0, count: 0 };
    const thisYear = result.thisYear.length > 0 ? result.thisYear[0] : { earnings: 0, count: 0 };

    return res.status(200).json({
      success: true,
      today,
      thisMonth,
      thisYear
    });

  } catch (error) {
    console.log("Error in getSellerEarnings controller", error);
    res.status(500).json({ message: "Internal server error" });
  }
};