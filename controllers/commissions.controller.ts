import { Response } from "express";
import { AuthRequest } from "../types/authRequest.js";
import { User } from "../models/user.model.js";
import { Order } from "../models/order.model.js";

export const getCommissions = async (req: AuthRequest, res: Response) => {
  try {
    const admin = await User.findById(req.user?.id);
    if (!admin || admin.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only admin can view commissions" });
    }

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const commissionsData = await Order.aggregate([
      {
        $match: {
          paymentStatus: "paid",
        },
      },
      {
        $addFields: {
          deliveryComm: {
            $subtract: [
              { $ifNull: ["$deliveryCharge", 0] },
              { $ifNull: ["$deliveryPartnerEarnings", 0] },
            ],
          },
          productComm: {
            $subtract: [
              { $ifNull: ["$platformTotalFee", 0] },
              {
                $subtract: [
                  { $ifNull: ["$deliveryCharge", 0] },
                  { $ifNull: ["$deliveryPartnerEarnings", 0] },
                ],
              },
            ],
          },
        },
      },
      {
        $facet: {
          today: [
            { $match: { createdAt: { $gte: startOfToday } } },
            {
              $group: {
                _id: null,
                earnings: { $sum: "$platformTotalFee" },
                delivery: { $sum: "$deliveryComm" },
                product: { $sum: "$productComm" },
                count: { $sum: 1 },
              },
            },
          ],
          thisMonth: [
            { $match: { createdAt: { $gte: startOfThisMonth } } },
            {
              $group: {
                _id: null,
                earnings: { $sum: "$platformTotalFee" },
                delivery: { $sum: "$deliveryComm" },
                product: { $sum: "$productComm" },
                count: { $sum: 1 },
              },
            },
          ],
          total: [
            {
              $group: {
                _id: null,
                earnings: { $sum: "$platformTotalFee" },
                delivery: { $sum: "$deliveryComm" },
                product: { $sum: "$productComm" },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    const result = commissionsData[0];

    const todayEarnings =
      result.today.length > 0 ? result.today[0].earnings : 0;
    const todayDelivery =
      result.today.length > 0 ? result.today[0].delivery : 0;
    const todayProduct = result.today.length > 0 ? result.today[0].product : 0;
    const todayOrders = result.today.length > 0 ? result.today[0].count : 0;

    const monthlyEarnings =
      result.thisMonth.length > 0 ? result.thisMonth[0].earnings : 0;
    const monthlyDelivery =
      result.thisMonth.length > 0 ? result.thisMonth[0].delivery : 0;
    const monthlyProduct =
      result.thisMonth.length > 0 ? result.thisMonth[0].product : 0;
    const monthlyOrders =
      result.thisMonth.length > 0 ? result.thisMonth[0].count : 0;

    const totalEarnings =
      result.total.length > 0 ? result.total[0].earnings : 0;
    const totalDelivery =
      result.total.length > 0 ? result.total[0].delivery : 0;
    const totalProduct = result.total.length > 0 ? result.total[0].product : 0;
    const totalOrders = result.total.length > 0 ? result.total[0].count : 0;

    return res.json({
      success: true,
      today: {
        earnings: todayEarnings,
        delivery: todayDelivery,
        product: todayProduct,
        orders: todayOrders,
      },
      thisMonth: {
        earnings: monthlyEarnings,
        delivery: monthlyDelivery,
        product: monthlyProduct,
        orders: monthlyOrders,
      },
      total: {
        earnings: totalEarnings,
        delivery: totalDelivery,
        product: totalProduct,
        orders: totalOrders,
      },
    });
  } catch (error) {
    console.error("Error calculating commissions:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
