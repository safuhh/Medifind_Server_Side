import { Cart } from "../models/cart.model.js";
import { Request, Response } from "express";

// Helper to find item in cart
const findItem = (cart: any, medicineId: string) => 
  cart.items.find((item: any) => item.medicineId.toString() === medicineId);

export const addToCart = async (req: Request, res: Response) => {
  try {
    const { medicineId, quantity, prescribedQty } = req.body;
    const userId = (req as any).user.id;
    
    let cart = await Cart.findOne({ userId });
    
    if (!cart) {
      cart = new Cart({
        userId,
        items: [{ medicineId, quantity, prescribedQty }],
      });
      await cart.save();
      return res.status(201).json({ success: true, cart });
    }

    const item = findItem(cart, medicineId);
    
    if (item) {
      const maxQty = prescribedQty || item.prescribedQty;
      item.quantity = maxQty ? Math.min(maxQty, item.quantity + quantity) : item.quantity + quantity;
      if (prescribedQty) item.prescribedQty = prescribedQty;
    } else {
      cart.items.push({ medicineId, quantity, prescribedQty });
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
    
    if (item.prescribedQty && item.quantity >= item.prescribedQty) {
      return res.status(400).json({ success: false, message: "Cannot exceed prescribed quantity" });
    }
    
    item.quantity += 1;
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
    
    return res.status(200).json({ success: true, cart });
  } catch (error) {
    console.error("Error getting cart:", error);
    return res.status(500).json({ success: false, message: "Failed to get cart" });
  }
};
