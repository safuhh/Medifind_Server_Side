import { Request, Response } from "express";
import { DeliveryBoy } from "../../models/deliveryRequste.model.js";
import { AuthRequest } from "../../types/authRequest.js";
import { User } from "../../models/user.model.js";
import { Order } from "../../models/order.model.js";
import { SellerRequest } from "../../models/sellerRequest.model.js";
import Stripe from "stripe";
import { calculateDistance } from "../../utils/geocode.js";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "sk_test_placeholder",
);

export const deliveryBoyDashboard = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized user" });
    }

    if (req.user.role !== "delivery_boy") {
      return res.status(403).json({ message: "Not a delivery boy" });
    }

    const deliveryBoy: any = await DeliveryBoy.findOne({ userId })
      .populate({
        path: "currentOrderId",
        populate: [
          { path: "deliveryDetailsId" },
          { path: "userId", select: "name email phone location" },
          { path: "items.medicineId" },
          {
            path: "items.sellerId",
            model: "User",
            select: "name email phone location",
          },
        ],
      })
      .lean();

    if (!deliveryBoy) {
      return res.status(404).json({ message: "Delivery Boy not found" });
    }

    if (deliveryBoy.status !== "approved") {
      return res.status(403).json({
        message: "Your account is not approved yet",
      });
    }

    // Fetch shop details for sellers
    if (deliveryBoy.currentOrderId && deliveryBoy.currentOrderId.items) {
      for (const item of deliveryBoy.currentOrderId.items) {
        if (item.sellerId && item.sellerId._id) {
          const sellerReq = await SellerRequest.findOne({
            userId: item.sellerId._id,
          });
          if (sellerReq) {
            item.sellerShop = {
              shopName: sellerReq.shopName,
              address: sellerReq.address,
              phone: sellerReq.phone,
              location: sellerReq.location,
            };
          } else {
            item.sellerShop = {
              shopName: item.sellerId.name || "Pharmacy",
              address:
                item.sellerId.location?.address || "Location unavailable",
              phone: item.sellerId.phone || "No phone",
              location: item.sellerId.location,
            };
          }
        }
      }
    }

    return res.json({
      deliveryBoy,
      message: "Dashboard loaded",
    });
  } catch (error) {
    console.log("ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAvailableOrders = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const deliveryBoy = await DeliveryBoy.findOne({ userId });
    if (!deliveryBoy || deliveryBoy.status !== "approved") {
      return res.status(403).json({ message: "Not an approved delivery boy" });
    }

    const availableOrders = await Order.find({
      paymentStatus: "paid",
      orderStatus: { $in: ["confirmed", "pending"] },
      $or: [{ deliveryBoyId: { $exists: false } }, { deliveryBoyId: null }],
    })
      .populate("deliveryDetailsId")
      .populate("userId", "name email phone location")
      .populate("items.medicineId")
      .populate({
        path: "items.sellerId",
        model: "User",
        select: "name phone location",
      })
      .sort({ createdAt: -1 })
      .lean();

    const deliveryBoyLat = deliveryBoy.location?.lat;
    const deliveryBoyLng = deliveryBoy.location?.lng;

    let filteredOrders = availableOrders;

    if (deliveryBoyLat !== undefined && deliveryBoyLng !== undefined) {
      filteredOrders = availableOrders.filter((order: any) => {
        let isWithinRange = false;
        
        // 1. Check distance to sellers
        if (order.items && order.items.length > 0) {
          for (const item of order.items) {
            const sellerLoc = item.sellerId?.location;
            if (sellerLoc?.coordinates && sellerLoc.coordinates.length === 2) {
              const sellerLng = sellerLoc.coordinates[0];
              const sellerLat = sellerLoc.coordinates[1];
              const dist = calculateDistance(deliveryBoyLat, deliveryBoyLng, sellerLat, sellerLng);
              if (dist <= 20) {
                isWithinRange = true;
                break;
              }
            }
          }
        }
        
        // 2. Alternatively, check distance to customer
        if (!isWithinRange && order.userId?.location?.coordinates && order.userId.location.coordinates.length === 2) {
          const customerLng = order.userId.location.coordinates[0];
          const customerLat = order.userId.location.coordinates[1];
          const dist = calculateDistance(deliveryBoyLat, deliveryBoyLng, customerLat, customerLng);
          if (dist <= 20) {
            isWithinRange = true;
          }
        }
        
        return isWithinRange;
      });
    }

    for (const order of filteredOrders) {
      if (order.items) {
        for (const item of order.items as any[]) {
          if (item.sellerId && item.sellerId._id) {
            const sellerReq = await SellerRequest.findOne({
              userId: item.sellerId._id,
            });
            if (sellerReq) {
              item.sellerShop = {
                shopName: sellerReq.shopName,
                address: sellerReq.address,
                phone: sellerReq.phone,
              };
            } else {
              item.sellerShop = {
                shopName: item.sellerId.name || "Pharmacy",
                address:
                  item.sellerId.location?.address || "Location unavailable",
                phone: item.sellerId.phone || "No phone",
              };
            }
          }
        }
      }
    }

    return res.json({ success: true, orders: filteredOrders });
  } catch (error) {
    console.log("ERROR fetching available orders:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const acceptOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.body;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const deliveryBoy = await DeliveryBoy.findOne({ userId });
    if (!deliveryBoy || deliveryBoy.status !== "approved") {
      return res.status(403).json({ message: "Not an approved delivery boy" });
    }

    if (deliveryBoy.currentOrderId) {
      return res
        .status(400)
        .json({ message: "You already have an active order" });
    }

    const order = await Order.findById(orderId);

    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.deliveryBoyId)
      return res
        .status(400)
        .json({ message: "Order already assigned to someone else" });

    order.deliveryBoyId = deliveryBoy._id;
    await order.save();

    deliveryBoy.currentOrderId = order._id;
    deliveryBoy.isAvailable = false;
    await deliveryBoy.save();

    const io = req.app.get("io");
    if (io) {
      const sellers = new Set(
        order.items.map((item: any) => item.sellerId.toString()),
      );
      sellers.forEach((sellerId) => {
        io.to(sellerId).emit("delivery_boy_coming", {
          orderId: order._id,
          message: "Delivery boy is on the way to pick up the order.",
        });
      });
    }

    return res.json({ success: true, message: "Order accepted successfully" });
  } catch (error) {
    console.log("ERROR accepting order:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const pickupOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, sellerId } = req.body;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (sellerId) {
      order.items.forEach((item) => {
        if (item.sellerId.toString() === sellerId.toString()) {
          item.isPickedUp = true;
        }
      });
    } else {
      order.items.forEach((item) => {
        item.isPickedUp = true;
      });
    }

    const allPickedUp = order.items.every((item) => item.isPickedUp);
    if (allPickedUp) {
      order.orderStatus = "picked_up";
    }

    await order.save();

    const io = req.app.get("io");
    if (io) {
      if (allPickedUp) {
        io.to(order.userId.toString()).emit("order_picked_up", {
          orderId: order._id,
          message: "Delivery boy has picked up your order and is on the way.",
        });
      } else {
        io.to(order.userId.toString()).emit("order_partially_picked_up", {
          orderId: order._id,
          message: "Delivery boy has picked up items from one of the shops.",
        });
      }
    }

    return res.json({ success: true, message: allPickedUp ? "Order picked up" : "Shop items picked up" });
  } catch (error) {
    console.log("ERROR picking up order:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const deliverOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.body;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const deliveryBoy = await DeliveryBoy.findOne({ userId });
    if (!deliveryBoy)
      return res.status(404).json({ message: "Delivery Boy not found" });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.orderStatus = "delivered";
    await order.save();

    // Stripe Connect transfers removed as per request.
    // The delivery earnings are still calculated and stored in the order model.

    deliveryBoy.currentOrderId = null;
    deliveryBoy.isAvailable = true;
    await deliveryBoy.save();

    const io = req.app.get("io");
    if (io) {
      io.to(order.userId.toString()).emit("order_delivered", {
        orderId: order._id,
        message: "Your order has been delivered successfully.",
      });
    }

    return res.json({ success: true, message: "Order delivered" });
  } catch (error) {
    console.log("ERROR delivering order:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
