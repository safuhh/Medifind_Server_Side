import { Request, Response } from "express";
import Stripe from "stripe";
import { Order } from "../models/order.model.js";
import { Cart } from "../models/cart.model.js";
import { Medicine } from "../models/medicine.model.js";
import { User } from "../models/user.model.js";
import { calculateDistance } from "../utils/geocode.js";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "sk_test_placeholder",
);

export const checkoutCart = async (req: Request, res: Response) => {
  try {
    const { deliveryDetailsId } = req.body;
    const userId = (req as any).user.id;

    if (!deliveryDetailsId) {
      return res
        .status(400)
        .json({ success: false, message: "Delivery details ID is required" });
    }

    const cart = await Cart.findOne({ userId }).populate("items.medicineId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    let totalAmount = 0;
    let platformTotalFee = 0;
    let sellerTotalEarnings = 0;
    const orderItems: any[] = [];
    const lineItems: any[] = [];

    const PLATFORM_COMMISSION_PERCENTAGE = 10; // Platform takes 10% from sellers

    // GST Calculation & Split
    for (const item of cart.items) {
      const medicine: any = item.medicineId;
      if (!medicine) continue;

      const basePrice = medicine.pricing.sellingPrice;
      const gstPercentage = medicine.pricing.gst || 0;
      const gstAmount = (basePrice * gstPercentage) / 100;
      const finalPrice = basePrice + gstAmount;

      const platformFee = (basePrice * PLATFORM_COMMISSION_PERCENTAGE) / 100;
      const sellerEarning = basePrice - platformFee + gstAmount;

      totalAmount += finalPrice * item.quantity;
      platformTotalFee += platformFee * item.quantity;
      sellerTotalEarnings += sellerEarning * item.quantity;

      orderItems.push({
        medicineId: medicine._id,
        sellerId: medicine.sellerId,
        quantity: item.quantity,
        price: finalPrice, // Includes GST
        platformFee,
        sellerEarning,
      });

      lineItems.push({
        price_data: {
          currency: "inr",
          product_data: {
            name: `${medicine.name} (Incl. ${gstPercentage}% GST)`,
            images: medicine.images?.length > 0 ? [medicine.images[0]] : [],
          },
          unit_amount: Math.round(finalPrice * 100),
        },
        quantity: item.quantity,
      });
    }

    // Delivery Charge Calculation & Split
    const buyer = await User.findById(userId);
    let deliveryCharge = 0;
    let deliveryPartnerEarnings = 0;
    const DELIVERY_RATE_PER_KM = 10; // ₹10 per km
    const DELIVERY_PLATFORM_CUT = 20; // Platform takes 20% of delivery charge

    if (
      buyer?.location?.coordinates &&
      buyer.location.coordinates.length === 2
    ) {
      const buyerLng = buyer.location.coordinates[0];
      const buyerLat = buyer.location.coordinates[1];

      const sellerIds = [
        ...new Set(orderItems.map((item) => item.sellerId.toString())),
      ];

      for (const sid of sellerIds) {
        const seller = await User.findById(sid);
        if (
          seller?.location?.coordinates &&
          seller.location.coordinates.length === 2
        ) {
          const sellerLng = seller.location.coordinates[0];
          const sellerLat = seller.location.coordinates[1];
          const dist = calculateDistance(
            buyerLat,
            buyerLng,
            sellerLat,
            sellerLng,
          );
          deliveryCharge += Math.round(dist * DELIVERY_RATE_PER_KM);
        } else {
          // Default delivery charge if seller location is missing
          deliveryCharge += 50;
        }
      }
    } else {
      // Default delivery charge if buyer location is missing
      deliveryCharge += 50;
    }

    if (deliveryCharge > 0) {
      // Split delivery charge
      const platformDeliveryCut =
        (deliveryCharge * DELIVERY_PLATFORM_CUT) / 100;
      deliveryPartnerEarnings = deliveryCharge - platformDeliveryCut;

      platformTotalFee += platformDeliveryCut;
      totalAmount += deliveryCharge;

      lineItems.push({
        price_data: {
          currency: "inr",
          product_data: {
            name: "Delivery Charge (Based on Distance)",
          },
          unit_amount: Math.round(deliveryCharge * 100),
        },
        quantity: 1,
      });
    }

    if (orderItems.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Valid items not found in cart" });
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    // Create Order in DB with Payment Distribution Matrix
    const order = await Order.create({
      userId,
      deliveryDetailsId,
      items: orderItems,
      totalAmount,
      deliveryCharge,
      platformTotalFee,
      sellerTotalEarnings,
      deliveryPartnerEarnings,
      paymentStatus: "pending",
      orderStatus: "pending",
    });

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        success_url: `${frontendUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/cart`,
        metadata: {
          orderId: order._id.toString(),
          userId: userId.toString(),
        },
      });

      order.stripeSessionId = session.id;
      await order.save();
    } catch (stripeError: any) {
      console.error("STRIPE INTENT ERROR:", stripeError.message);
      if (
        !process.env.STRIPE_SECRET_KEY ||
        process.env.STRIPE_SECRET_KEY === "sk_test_placeholder"
      ) {
        // Mock session for testing
        session = {
          id: "mock_session_" + Date.now(),
          url:
            `${frontendUrl}/order/success?session_id=mock_session_` +
            Date.now(),
        };
        order.stripeSessionId = session.id;
        await order.save();
      } else {
        throw stripeError;
      }
    }

    return res.status(200).json({ success: true, url: session.url });
  } catch (error: any) {
    console.error("Checkout Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const confirmOrderPayment = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    const userId = (req as any).user.id;

    if (!sessionId) {
      return res
        .status(400)
        .json({ success: false, message: "Session ID is required" });
    }

    const order = await Order.findOne({ stripeSessionId: sessionId });

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order.paymentStatus === "paid") {
      return res.status(200).json({ success: true, order });
    }

    // Update order status
    order.paymentStatus = "paid";
    order.orderStatus = "confirmed";
    await order.save();

    // --- NEW FEATURE: Stripe Connect Transfers ---
    // Transfer money to sellers
    const sellers = [
      ...new Set(order.items.map((item) => item.sellerId.toString())),
    ];

    for (const sellerId of sellers) {
      const seller = await User.findById(sellerId);

      // Calculate total earnings for this specific seller in this order
      const sellerEarning = order.items
        .filter((item) => item.sellerId.toString() === sellerId)
        .reduce((sum, item) => sum + item.sellerEarning, 0);

      const destinationAccount = seller?.stripeAccountId;

      if (destinationAccount && sellerEarning > 0) {
        try {
          await stripe.transfers.create({
            amount: Math.round(sellerEarning * 100), // Convert to cents/paise
            currency: "inr",
            destination: destinationAccount,
            description: `Payout for Order ${order._id}`,
          });
          console.log(
            `Successfully transferred ${sellerEarning} to seller ${sellerId}`,
          );
        } catch (err: any) {
          console.error(
            `Failed to transfer to seller ${sellerId}:`,
            err.message,
          );
        }
      } else {
        console.log(
          `Skipping transfer for seller ${sellerId} (No Stripe account linked or earnings 0)`,
        );
      }
    }
    // ----------------------------------------------

    // Decrease the stock for each medicine
    for (const item of order.items) {
      await Medicine.findByIdAndUpdate(item.medicineId, {
        $inc: { stock: -item.quantity },
      });
    }

    // Clear the cart
    await Cart.findOneAndUpdate({ userId }, { items: [] });

    // Optional: Notify Sellers using socket.io
    const io = req.app.get("io");
    if (io) {
      // Group items by seller and notify them
      const sellers = new Set(
        order.items.map((item) => item.sellerId.toString()),
      );
      sellers.forEach((sellerId) => {
        io.to(sellerId).emit("new_order_received", {
          orderId: order._id,
        });
      });
    }

    return res.status(200).json({ success: true, order });
  } catch (error: any) {
    console.error("Confirm Payment Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
