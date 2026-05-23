import { Order } from "../../models/order.model.js";
import { Request, Response } from "express";
import mongoose from "mongoose";

export const mostselingproductsinpharmacy = async (
  req: Request,
  res: Response,
) => {
  try {
    const { sellerId } = req.params;
    const range = req.query.range as string | undefined;

    let dateLimit: Date | null = null;
    const now = new Date();

    if (range === "weekly") {
      dateLimit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === "monthly") {
      dateLimit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (range === "yearly") {
      dateLimit = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    }

    const matchQuery: any = {
      paymentStatus: "paid",
      "items.sellerId": new mongoose.Types.ObjectId(sellerId as string),
    };

    if (dateLimit) {
      matchQuery.createdAt = { $gte: dateLimit };
    }

    const mostselling = await Order.aggregate([
      {
        $match: matchQuery,
      },

      {
        $unwind: "$items",
      },

      {
        $match: {
          "items.sellerId": new mongoose.Types.ObjectId(sellerId as string),
        },
      },

      {
        $group: {
          _id: "$items.medicineId",

          totalQuantity: {
            $sum: "$items.quantity",
          },

          totalSales: {
            $sum: {
              $multiply: [
                "$items.quantity",
                { $multiply: ["$items.platformFee", 10] },
              ],
            },
          },
        },
      },

      {
        $sort: {
          totalQuantity: -1,
        },
      },

      {
        $lookup: {
          from: "medicines",
          localField: "_id",
          foreignField: "_id",
          as: "productInfo",
        },
      },

      {
        $unwind: {
          path: "$productInfo",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $project: {
          _id: 0,
          productId: "$_id",
          productName: "$productInfo.name",
          image: { $arrayElemAt: ["$productInfo.images", 0] },
          totalQuantity: 1,
          totalSales: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: mostselling,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
