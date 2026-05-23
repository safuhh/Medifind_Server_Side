import { Request, Response } from "express";
import DeliveryDetails from "../../models/deliveryDetails.model.js";
import { deliveryDetailsSchema } from "../../validations/deliveryDetails.validation.js";
import { AuthRequest } from "../../types/authRequest.js";

export const createDeliveryDetails = async (req: AuthRequest, res: Response) => {
  try {
    console.log("createDeliveryDetails body:", req.body);
    const { error } = deliveryDetailsSchema.validate(req.body);
    if (error) {
      console.log("Validation error:", error?.details?.[0]?.message);
      return res.status(400).json({ success: false, message: error?.details?.[0]?.message });
    }

    const { name, address, landmark, city, state, zip, country, phone, email } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const deliveryDetails = new DeliveryDetails({
      name,
      address,
      landmark,
      city,
      state,
      zip,
      country,
      phone,
      email,
      userId,
    });
    await deliveryDetails.save();
    console.log("Saved delivery details successfully:", deliveryDetails._id);
    res.status(201).json({ success: true, data: deliveryDetails });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getDeliveryDetails = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const deliveryDetails = await DeliveryDetails.find({ userId });
    res.status(200).json({ success: true, data: deliveryDetails });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
export const updateDeliveryDetails = async (req: AuthRequest, res: Response) => {
  try {
    const { error } = deliveryDetailsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error?.details?.[0]?.message });
    }

    const { name, address, landmark, city, state, zip, country, phone, email } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const deliveryDetails = await DeliveryDetails.findOneAndUpdate(
      { userId },
      { name, address, landmark, city, state, zip, country, phone, email },
      { new: true },
    );
    res.status(200).json({ success: true, data: deliveryDetails });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
export const deleteDeliveryDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deliveryDetails = await DeliveryDetails.findByIdAndDelete(id);
    res.status(200).json({ success: true, data: deliveryDetails });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
export const getUserDeliveryDetails = async (req: Request, res: Response) => {
  try {
    const deliveryDetails = await DeliveryDetails.findById(req.params.id);
    if (!deliveryDetails) {
      return res
        .status(404)
        .json({ success: false, message: "Delivery details not found" });
    }
    res.status(200).json({ success: true, data: deliveryDetails });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
