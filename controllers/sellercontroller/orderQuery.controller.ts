import { Request, Response } from "express";
import { Order } from "../../models/order.model.js";

export const getSellerOrders = async (req: Request, res: Response) => {
  try {
    const sellerId = (req as any).user.id;

    // Find all orders that contain an item for this seller and have been paid
    const orders = await Order.find({
      "items.sellerId": sellerId,
      paymentStatus: "paid",
    })
      .populate("userId", "name email phone")
      .populate("deliveryDetailsId")
      .populate("items.medicineId")
      .sort({ createdAt: -1 });

    // Filter items in each order to only include items for this seller
    const formattedOrders = orders.map((order: any) => {
      const sellerItems = order.items.filter(
        (item: any) => item.sellerId.toString() === sellerId,
      );

      let sellerTotal = 0;
      sellerItems.forEach((item: any) => {
        sellerTotal += item.price * item.quantity;
      });

      return {
        _id: order._id,
        user: order.userId,
        deliveryDetails: order.deliveryDetailsId,
        items: sellerItems,
        sellerTotal,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
      };
    });

    return res.status(200).json({ success: true, orders: formattedOrders });
  } catch (error: any) {
    console.error("Get Seller Orders Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

export const getUserOrders = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const orders = await Order.find({ userId, paymentStatus: "paid" })
      .populate("deliveryDetailsId")
      .populate("items.medicineId")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, orders });
  } catch (error: any) {
    console.error("Get User Orders Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
