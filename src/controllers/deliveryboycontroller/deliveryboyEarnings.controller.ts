import { Response } from "express";
import { DeliveryBoy } from "../../models/deliveryRequste.model.js";
import { Order } from "../../models/order.model.js";
import { AuthRequest } from "../../types/authRequest.js";

export const getearnings = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // 1. Find the delivery boy profile to get their ID
    const deliveryBoy = await DeliveryBoy.findOne({ userId });
    if (!deliveryBoy) {
      return res
        .status(404)
        .json({ message: "Delivery boy profile not found" });
    }

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 2. Aggregate earnings from delivered orders
    const earningsData = await Order.aggregate([
      {
        $match: {
          deliveryBoyId: deliveryBoy._id,
          orderStatus: "delivered",
        },
      },
      {
        $facet: {
          today: [
            { $match: { createdAt: { $gte: startOfToday } } },
            {
              $group: {
                _id: null,
                earnings: { $sum: "$deliveryPartnerEarnings" },
                count: { $sum: 1 },
              },
            },
          ],
          thisMonth: [
            { $match: { createdAt: { $gte: startOfThisMonth } } },
            {
              $group: {
                _id: null,
                earnings: { $sum: "$deliveryPartnerEarnings" },
                count: { $sum: 1 },
              },
            },
          ],
          total: [
            {
              $group: {
                _id: null,
                earnings: { $sum: "$deliveryPartnerEarnings" },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    const result = earningsData[0];

    const todayEarnings =
      result.today.length > 0 ? result.today[0].earnings : 0;
    const todayOrders = result.today.length > 0 ? result.today[0].count : 0;

    const monthlyEarnings =
      result.thisMonth.length > 0 ? result.thisMonth[0].earnings : 0;
    const monthlyOrders =
      result.thisMonth.length > 0 ? result.thisMonth[0].count : 0;

    const totalEarnings =
      result.total.length > 0 ? result.total[0].earnings : 0;
    const totalOrders = result.total.length > 0 ? result.total[0].count : 0;

    return res.json({
      success: true,
      today: { earnings: todayEarnings, orders: todayOrders },
      thisMonth: { earnings: monthlyEarnings, orders: monthlyOrders },
      total: { earnings: totalEarnings, orders: totalOrders },
      deliveryBoyId: deliveryBoy._id,
    });
  } catch (error) {
    console.error("Error calculating earnings:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
