import { Cart } from "../../models/cart.model.js";
import { Request, Response } from "express";
import { Medicine } from "../../models/medicine.model.js";
import { HealthReport } from "../../models/healthReport.model.js";
import { Order } from "../../models/order.model.js";

// Helper to find item in cart
const findItem = (cart: any, medicineId: string) => 
  cart.items.find((item: any) => item.medicineId.toString() === medicineId);

export const getRemainingPrescribedQty = async (userId: string, medicineId: string): Promise<number | undefined> => {
  const targetMedicine = await Medicine.findById(medicineId);
  if (!targetMedicine) {
    return undefined;
  }

  const searchNames = [targetMedicine.name];
  if (targetMedicine.genericName) {
    searchNames.push(targetMedicine.genericName);
  }

  // Fetch all user reports to find the latest matching prescription
  const reports = await HealthReport.find({ patientId: userId }).sort({ createdAt: -1 });
  let latestReport = null;
  let medItem = null;

  for (const report of reports) {
    medItem = (report.medicines || []).find(m => {
      if (m.medicineId && m.medicineId.toString() === medicineId.toString()) return true;
      
      const reportMedName = m.name?.trim().toLowerCase();
      if (!reportMedName) return false;

      // Fuzzy matching: if one name contains the other
      return searchNames.some(name => {
        const sName = name.trim().toLowerCase();
        return reportMedName.includes(sName) || sName.includes(reportMedName);
      });
    });

    if (medItem) {
      latestReport = report;
      break;
    }
  }

  if (!latestReport || !medItem) {
    // If Rx required, return 0 (blocked). Else undefined (unlimited).
    return targetMedicine.isPrescriptionRequired ? 0 : undefined;
  }
  const prescribedLimit = medItem.quantity;

  const paidOrders = await Order.find({
    userId,
    paymentStatus: "paid",
    createdAt: { $gte: latestReport.createdAt }
  });

  let purchasedQty = 0;
  if (paidOrders.length > 0) {
    const orderMedIds = [];
    for (const order of paidOrders) {
      for (const item of order.items) {
        orderMedIds.push(item.medicineId);
      }
    }

    const medicinesInOrders = await Medicine.find({ _id: { $in: orderMedIds } });
    const medMap = new Map<string, { name: string; genericName?: string }>();
    for (const med of medicinesInOrders) {
      const entry: { name: string; genericName?: string } = {
        name: med.name.toLowerCase()
      };
      if (med.genericName) {
        entry.genericName = med.genericName.toLowerCase();
      }
      medMap.set(med._id.toString(), entry);
    }

    for (const order of paidOrders) {
      for (const item of order.items) {
        const itemMedId = item.medicineId.toString();
        const medInfo = medMap.get(itemMedId);
        
        let isMatch = false;
        if (itemMedId === medicineId.toString()) {
          isMatch = true;
        } else if (medInfo) {
          const searchNamesLower = searchNames.map(n => n.toLowerCase());
          if (searchNamesLower.includes(medInfo.name)) {
            isMatch = true;
          } else if (medInfo.genericName && searchNamesLower.includes(medInfo.genericName)) {
            isMatch = true;
          }
        }
        
        if (isMatch) {
          purchasedQty += item.quantity;
        }
      }
    }
  }

  const remaining = prescribedLimit - purchasedQty;
  return remaining < 0 ? 0 : remaining;
};

export const addToCart = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const quantity = Number(req.body.quantity);
    const { medicineId } = req.body;

    const medicine = await Medicine.findById(medicineId);
    if (!medicine) {
      return res.status(404).json({ success: false, message: "Medicine not found" });
    }

    if (medicine.sellerId.toString() === userId) {
      return res.status(400).json({ success: false, message: "Sellers cannot buy their own products" });
    }

    // Fetch remaining prescribed quantity limit
    const remainingLimit = await getRemainingPrescribedQty(userId, medicineId);
    
    let cart = await Cart.findOne({ userId });
    
    if (!cart) {
      if (remainingLimit !== undefined && quantity > remainingLimit) {
        return res.status(400).json({ success: false, message: `Cannot exceed remaining prescribed quantity of ${remainingLimit} units` });
      }
      cart = new Cart({
        userId,
        items: [{ medicineId, quantity, prescribedQty: remainingLimit }],
      });
      await cart.save();
      return res.status(201).json({ success: true, cart });
    }

    const item = findItem(cart, medicineId);
    
    if (item) {
      const newQty = item.quantity + quantity;
      
      if (remainingLimit !== undefined && newQty > remainingLimit) {
        return res.status(400).json({ success: false, message: `Cannot exceed remaining prescribed quantity of ${remainingLimit} units` });
      }
      if (newQty > medicine.stock) {
        return res.status(400).json({ success: false, message: `Only ${medicine.stock} units available in stock` });
      }
      
      item.quantity = newQty;
      if (remainingLimit !== undefined) item.prescribedQty = remainingLimit;
    } else {
      if (remainingLimit !== undefined && quantity > remainingLimit) {
        return res.status(400).json({ success: false, message: `Cannot exceed remaining prescribed quantity of ${remainingLimit} units` });
      }
      if (quantity > medicine.stock) {
        return res.status(400).json({ success: false, message: `Only ${medicine.stock} units available in stock` });
      }
      cart.items.push({ medicineId, quantity, prescribedQty: remainingLimit } as any);
    }
    
    await cart.save();
    return res.status(200).json({ success: true, cart });
  } catch (error) {
    console.error("Error adding to cart:", error);
    return res.status(500).json({ success: false, message: "Failed to add to cart" });
  }
};

export const increaseQuantity = async (req: Request, res: Response) => {
  try {
    const { medicineId } = req.body;
    const userId = (req as any).user.id;
    
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }
    
    const item = findItem(cart, medicineId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found in cart" });
    }
    
    const medicine = await Medicine.findById(medicineId);
    if (!medicine) {
      return res.status(404).json({ success: false, message: "Medicine not found" });
    }
    
    if (item.quantity + 1 > medicine.stock) {
      return res.status(400).json({ success: false, message: `Only ${medicine.stock} units available in stock` });
    }
    
    // Fetch remaining prescribed quantity limit
    const remainingLimit = await getRemainingPrescribedQty(userId, medicineId);
    
    if (remainingLimit !== undefined && item.quantity + 1 > remainingLimit) {
      return res.status(400).json({ success: false, message: `Cannot exceed remaining prescribed quantity of ${remainingLimit} units` });
    }
    
    item.quantity += 1;
    if (remainingLimit !== undefined) {
      item.prescribedQty = remainingLimit;
    }
    await cart.save();
    await Cart.populate(cart, { path: "items.medicineId" });
    return res.status(200).json({ success: true, cart });
  } catch (error) {
    console.error("Error increasing quantity:", error);
    return res.status(500).json({ success: false, message: "Failed to increase quantity" });
  }
};

export const decreaseQuantity = async (req: Request, res: Response) => {
  try {
    const { medicineId } = req.body;
    const userId = (req as any).user.id;
    
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }
    
    const item = findItem(cart, medicineId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found in cart" });
    }
    
    if (item.quantity <= 1) {
      return res.status(400).json({ success: false, message: "Quantity cannot be less than 1" });
    }
    
    item.quantity -= 1;
    await cart.save();
    await Cart.populate(cart, { path: "items.medicineId" });
    return res.status(200).json({ success: true, cart });
  } catch (error) {
    console.error("Error decreasing quantity:", error);
    return res.status(500).json({ success: false, message: "Failed to decrease quantity" });
  }
};

export const deleteCart = async (req: Request, res: Response) => {
  try {
    const { medicineId } = req.body;
    const userId = (req as any).user.id;
    
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }
    
    const item = findItem(cart, medicineId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found in cart" });
    }
    
    cart.items = cart.items.filter((item: any) => item.medicineId.toString() !== medicineId);
    await cart.save();
    return res.status(200).json({ success: true, cart });
  } catch (error) {
    console.error("Error deleting from cart:", error);
    return res.status(500).json({ success: false, message: "Failed to delete from cart" });
  }
};

export const getCart = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const cart = await Cart.findOne({ userId }).populate("items.medicineId");
    
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }
    
    // Update prescribedQty for each item based on latest remaining quantity
    let updated = false;
    for (const item of cart.items) {
      const medId = (item.medicineId as any)?._id?.toString() || item.medicineId?.toString();
      if (medId) {
        const remainingLimit = await getRemainingPrescribedQty(userId, medId);
        if (remainingLimit !== undefined && item.prescribedQty !== remainingLimit) {
          item.prescribedQty = remainingLimit;
          updated = true;
        }
      }
    }
    if (updated) {
      await cart.save();
    }
    
    return res.status(200).json({ success: true, cart });
  } catch (error) {
    console.error("Error getting cart:", error);
    return res.status(500).json({ success: false, message: "Failed to get cart" });
  }
};

export const checkRemainingPrescribedQty = async (req: Request, res: Response) => {
  try {
    const { medicineId } = req.params;
    const userId = (req as any).user.id;

    if (!medicineId) {
      return res.status(400).json({ success: false, message: "Medicine ID is required" });
    }

    const remainingLimit = await getRemainingPrescribedQty(userId, medicineId as string);

    return res.status(200).json({
      success: true,
      remainingLimit
    });
  } catch (error) {
    console.error("Error checking remaining prescribed quantity:", error);
    return res.status(500).json({ success: false, message: "Failed to check remaining quantity" });
  }
};
