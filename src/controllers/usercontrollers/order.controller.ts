import { Request, Response } from "express";
import Stripe from "stripe";
import { FulfillmentService } from "../../services/fulfillment.service.js";
import axios from "axios";
import { Order } from "../../models/order.model.js";
import { Cart } from "../../models/cart.model.js";
import { Medicine } from "../../models/medicine.model.js";
import { User } from "../../models/user.model.js";
import { DeliveryBoy } from "../../models/deliveryRequste.model.js";
import { calculateDistance } from "../../utils/geocode.js";
import { HealthReport } from "../../models/healthReport.model.js";
import { getRemainingPrescribedQty } from "./cart.controller.js";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "sk_test_placeholder",
);

export const checkoutCart = async (req: Request, res: Response) => {
  try {
    const { deliveryDetailsId, buyNowMedicineId, buyNowQuantity, splitFulfillmentId } = req.body;
    const userId = (req as any).user.id;

    if (!deliveryDetailsId) {
      return res
        .status(400)
        .json({ success: false, message: "Delivery details ID is required" });
    }

    let items: any[] = [];
    const isBuyNow = !!(buyNowMedicineId && buyNowQuantity);

    if (splitFulfillmentId) {
      const serviceUrl = process.env.AI_FULFILLMENT_URL || "http://localhost:5001";
      console.log(`Connecting to AI Fulfillment Service for splits: ${serviceUrl}/api/ai/fulfillment/prescription/${splitFulfillmentId}`);
      let response;
      try {
        response = await axios.get(`${serviceUrl}/api/ai/fulfillment/prescription/${splitFulfillmentId}`);
      } catch (err: any) {
        console.error("AI Fulfillment plan retrieval failed:", err.message);
        return res.status(400).json({
          success: false,
          message: "AI Fulfillment plan not found or retrieval failed. Please try again.",
        });
      }
      
      if (response?.data?.status !== "success" || !response?.data?.data) {
        return res.status(400).json({ success: false, message: "AI Fulfillment plan not found or invalid" });
      }
      
      const plan = response.data.data;
      const resolvedItems: any[] = [];
      const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      
      for (const split of plan.splits) {
        const pharmacyId = split.pharmacyId._id || split.pharmacyId;
        for (const splitItem of split.medicines) {
          const medicine = await Medicine.findOne({
            name: { $regex: new RegExp("^" + escapeRegExp(splitItem.name) + "$", "i") },
            sellerId: pharmacyId,
            isActive: true,
          });
          
          if (!medicine) {
            return res.status(400).json({
              success: false,
              message: `Medicine ${splitItem.name} not found at pharmacy ${split.pharmacyName}`,
            });
          }
          
          resolvedItems.push({
            medicineId: medicine,
            quantity: splitItem.quantity || 1,
          });
        }
      }
      
      items = resolvedItems;
    } else if (isBuyNow) {
      const medicine = await Medicine.findById(buyNowMedicineId);
      if (!medicine) {
        return res.status(404).json({ success: false, message: "Medicine not found" });
      }
      items = [{ medicineId: medicine, quantity: Number(buyNowQuantity) }];
    } else {
      const cart = await Cart.findOne({ userId }).populate("items.medicineId");
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ success: false, message: "Cart is empty" });
      }
      items = cart.items;
    }

    // Validate prescription quantity limits for all orders (including AI split orders)
    for (const item of items) {
      const medicine: any = item.medicineId;
      if (!medicine) continue;

      const medicineIdStr = medicine._id ? medicine._id.toString() : medicine.toString();
      const remainingLimit = await getRemainingPrescribedQty(userId, medicineIdStr);

      if (remainingLimit !== undefined && item.quantity > remainingLimit) {
        return res.status(400).json({
          success: false,
          message: `Cannot purchase ${medicine.name || "medicine"}. Ordered quantity (${item.quantity}) exceeds your remaining prescribed limit of ${remainingLimit} units.`
        });
      }
    }


    let totalAmount = 0;
    let platformTotalFee = 0;
    let sellerTotalEarnings = 0;
    const orderItems: any[] = [];
    const lineItems: any[] = [];

    const PLATFORM_COMMISSION_PERCENTAGE = 10; // Platform takes 10% from sellers

    // GST Calculation & Split
    for (const item of items) {
      const medicine: any = item.medicineId;
      if (!medicine) continue;

      if (medicine.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${medicine.name}. Only ${medicine.stock} units available.`,
        });
      }

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

    const frontendUrl = process.env.FRONTEND_URL || "https://medifind-client-side.vercel.app";

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
      statusHistory: [{ status: "pending", timestamp: new Date() }],
      isBuyNow,
      splitFulfillmentId,
    });

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        success_url: `${frontendUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: isBuyNow ? `${frontendUrl}/medicines/${buyNowMedicineId}` : `${frontendUrl}/cart`,
        metadata: {
          orderId: order._id.toString(),
          userId: userId.toString(),
          splitFulfillmentId: splitFulfillmentId || "",
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

    // Verify payment status with Stripe (if not mock session)
    if (!sessionId.startsWith("mock_session_")) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== "paid") {
          return res.status(400).json({ 
            success: false, 
            message: "Payment is not completed. Stripe status: " + session.payment_status 
          });
        }
      } catch (stripeError: any) {
        console.error("Stripe Session Retrieval Error:", stripeError);
        return res.status(400).json({ 
          success: false, 
          message: "Failed to verify payment status with Stripe." 
        });
      }
    }

    // Update order status
    order.paymentStatus = "paid";
    order.orderStatus = "confirmed";
    if (!order.statusHistory) {
      order.statusHistory = [{ status: "pending", timestamp: order.createdAt || new Date() }];
    }
    order.statusHistory.push({ status: "confirmed", timestamp: new Date() });
    await order.save();

    const io = req.app.get("io");
    if (io) {
      io.to(order.userId.toString()).emit("order_status_update", {
        orderId: order._id,
        status: "confirmed"
      });
    }

    // If order was placed via an AI split fulfillment plan, confirm it in the microservice
    if (order.splitFulfillmentId) {
      try {
        const serviceUrl = process.env.AI_FULFILLMENT_URL || "http://localhost:5001";
        console.log(`Connecting to AI Fulfillment Service to confirm split: ${serviceUrl}/api/ai/fulfillment/prescription/${order.splitFulfillmentId}`);
        const response = await axios.get(`${serviceUrl}/api/ai/fulfillment/prescription/${order.splitFulfillmentId}`);
        if (response.data?.status === "success" && response.data?.data?._id) {
          const fulfillmentId = response.data.data._id;
          await axios.patch(`${serviceUrl}/api/ai/fulfillment/${fulfillmentId}/confirm`);
          console.log(`AI Fulfillment Plan ${fulfillmentId} confirmed successfully!`);
        }
      } catch (err: any) {
        console.error("⚠️ Failed to confirm AI fulfillment plan status:", err.message);
      }
    }

    // Stripe Connect transfers removed as per request.
    // The split amounts are still calculated and stored in the order model.

    // Decrease the stock for each medicine
    for (const item of order.items) {
      const updatedMedicine = await Medicine.findByIdAndUpdate(
        item.medicineId,
        { $inc: { stock: -item.quantity } },
        { new: true }
      );

      if (updatedMedicine && updatedMedicine.stock < 10) {
        if (io) {
          io.to(updatedMedicine.sellerId.toString()).emit("low_stock_alert", {
            medicineId: updatedMedicine._id,
            name: updatedMedicine.name,
            stock: updatedMedicine.stock,
          });
        }
      }
    }

    // Clear the cart only if it's not a direct Buy Now checkout
    if (!order.isBuyNow) {
      await Cart.findOneAndUpdate({ userId }, { items: [] });
    }

    // Optional: Notify Sellers using socket.io
    if (io) {
      // Group items by seller and notify them
      const sellers = new Set(
        order.items.map((item: any) => item.sellerId.toString()),
      );
      sellers.forEach((sellerId) => {
        io.to(sellerId).emit("new_order_received", {
          orderId: order._id,
        });
      });
      
      // Notify targeted delivery boys based on proximity
      try {
        const sellerUsers = await User.find({ _id: { $in: Array.from(sellers) } });
        const buyer = await User.findById(userId);
        
        const availableBoys = await DeliveryBoy.find({ status: "approved", isAvailable: true, isOnline: true });
        let notifiedCount = 0;
        
        for (const boy of availableBoys) {
          let isWithinRange = false;
          
          if (boy.location && boy.location.lat && boy.location.lng) {
            // Check distance to sellers
            for (const seller of sellerUsers) {
              if (seller.location?.coordinates && seller.location.coordinates.length === 2) {
                const sellerLng = seller.location.coordinates[0];
                const sellerLat = seller.location.coordinates[1];
                const dist = calculateDistance(boy.location.lat, boy.location.lng, sellerLat, sellerLng);
                if (dist <= 15) {
                  isWithinRange = true;
                  break;
                }
              }
            }
            
            // Check distance to buyer
            if (!isWithinRange && buyer?.location?.coordinates && buyer.location.coordinates.length === 2) {
              const customerLng = buyer.location.coordinates[0];
              const customerLat = buyer.location.coordinates[1];
              const dist = calculateDistance(boy.location.lat, boy.location.lng, customerLat, customerLng);
              if (dist <= 25) {
                isWithinRange = true;
              }
            }
            
            if (isWithinRange) {
              io.to(`delivery_boy_${boy.userId}`).emit("new_order_available", { orderId: order._id });
              notifiedCount++;
            }
          } else {
             // If delivery boy has no valid location coords, skip or notify?
             // Let's not spam delivery boys without location unless fallback hits.
          }
        }
        
        // Fallback: if no delivery boy is nearby, we just log it.
        // We do not broadcast to all, to prevent distant delivery boys from getting alerts.
        if (notifiedCount === 0) {
          console.log(`No delivery boys within range for order ${order._id}. They will have to wait for someone to come closer.`);
        }
      } catch (err) {
        console.error("Error sending targeted delivery notifications:", err);
      }
    }

    return res.status(200).json({ success: true, order });
  } catch (error: any) {
    console.error("Confirm Payment Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

export const getOptimizedSplits = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { prescriptionId, patientCoords, medicines: reqMedicines } = req.body;

    let medicines: any[] = [];

    if (reqMedicines && Array.isArray(reqMedicines) && reqMedicines.length > 0) {
      medicines = reqMedicines;
    } else {
      const cart = await Cart.findOne({ userId }).populate("items.medicineId");
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ success: false, message: "Cart is empty" });
      }

      medicines = cart.items
        .map((item: any) => ({
          name: item.medicineId?.name,
          quantity: item.quantity
        }))
        .filter((item: any) => item.name);
    }

    if (medicines.length === 0) {
      return res.status(400).json({ success: false, message: "No valid medicines specified" });
    }

    // Resolve patient coordinates if not passed
    let finalCoords = patientCoords;
    if (!finalCoords) {
      const buyer = await User.findById(userId);
      if (buyer?.location?.coordinates && buyer.location.coordinates.length === 2) {
        // [longitude, latitude] -> [latitude, longitude] for the microservice
        finalCoords = [buyer.location.coordinates[1], buyer.location.coordinates[0]];
      }
    }

    const plan = await FulfillmentService.optimizeFulfillment(
      prescriptionId || `cart-${userId}-${Date.now()}`,
      userId,
      medicines,
      finalCoords as [number, number]
    );

    return res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (error: any) {
    console.error("AI Fulfillment Split Error:", error?.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: error?.response?.data?.message || error.message || "Failed to split order using AI",
    });
  }
};

export const planFulfillmentPrescription = async (req: Request, res: Response) => {
  try {
    const { prescription, pharmacies } = req.body;

    if (!prescription || !Array.isArray(prescription)) {
      return res.status(400).json({ 
        success: false, 
        message: "Required parameter: 'prescription' must be an array of strings" 
      });
    }

    if (!pharmacies || !Array.isArray(pharmacies)) {
      return res.status(400).json({ 
        success: false, 
        message: "Required parameter: 'pharmacies' must be an array of pharmacy objects" 
      });
    }

    const responseData = await FulfillmentService.planFulfillment(
      prescription,
      pharmacies
    );

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error: any) {
    console.error("AI Fulfillment Planner Error:", error?.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: error?.response?.data?.message || error.message || "Failed to calculate plan using AI Planner",
    });
  }
};


