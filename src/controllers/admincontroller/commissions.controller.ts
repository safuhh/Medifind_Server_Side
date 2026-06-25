import { Response } from "express";
import { AuthRequest } from "../../types/authRequest.js";
import { User } from "../../models/user.model.js";
import { SubscriptionPayment } from "../../models/subscriptionPayment.model.js";
import { Subscription } from "../../models/subscription.model.js";
import { Order } from "../../models/order.model.js";

export const getCommissions = async (req: AuthRequest, res: Response) => {
  try {
    const admin = await User.findById(req.user?.id);
    if (!admin || admin.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only admin can view commissions" });
    }

    // 1. Get earnings using aggregation
    const paymentStats = await SubscriptionPayment.aggregate([
      {
        $group: {
          _id: "$role",
          total: { $sum: "$amountPaid" }
        }
      }
    ]);

    let totalEarnings = 0;
    let sellerEarnings = 0;
    let doctorEarnings = 0;

    paymentStats.forEach((stat) => {
      totalEarnings += stat.total;
      if (stat._id === "seller") sellerEarnings = stat.total;
      if (stat._id === "doctor") doctorEarnings = stat.total;
    });

    // 2. Get subscriber counts using aggregation
    const subStats = await Subscription.aggregate([
      { $match: { isPro: true } },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userDoc"
        }
      },
      { $unwind: "$userDoc" },
      {
        $group: {
          _id: { role: "$userDoc.role", plan: { $trim: { input: "$planType" } } },
          count: { $sum: 1 }
        }
      }
    ]);

    let sellerCount = 0;
    let doctorCount = 0;
    let monthlySellerCount = 0;
    let yearlySellerCount = 0;
    let monthlyDoctorCount = 0;
    let yearlyDoctorCount = 0;

    subStats.forEach((stat) => {
      const role = stat._id.role;
      const plan = stat._id.plan;
      const cnt = stat.count;

      if (role === "seller") {
        sellerCount += cnt;
        if (plan === "PRO_MONTHLY") monthlySellerCount += cnt;
        if (plan === "PRO_YEARLY") yearlySellerCount += cnt;
      } else if (role === "doctor") {
        doctorCount += cnt;
        if (plan === "PRO_MONTHLY") monthlyDoctorCount += cnt;
        if (plan === "PRO_YEARLY") yearlyDoctorCount += cnt;
      }
    });

    return res.json({
      success: true,
      totalEarnings,
      sellerEarnings,
      doctorEarnings,
      sellerCount,
      doctorCount,
      monthlySellerCount,
      yearlySellerCount,
      monthlyDoctorCount,
      yearlyDoctorCount,
    });
  } catch (error) {
    console.error("Error calculating subscription earnings:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
