import { Response } from "express";
import { AuthRequest } from "../types/authRequest.js";
import { User } from "../models/user.model.js";
import { DeliveryBoy } from "../models/deliveryRequste.model.js";
import { sendEmail } from "../utils/sendEmail.js";

export const approveDeliveryBoy = async (req: AuthRequest, res: Response) => {
  try {
    const admin = await User.findById(req.user?.id);

    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ message: "Only admin can approve" });
    }

    const { requestId } = req.params;

    const request = await DeliveryBoy.findOneAndUpdate(
      { _id: requestId, status: "pending" },
      {
        status: "approved",
        isAvailable: true,
        isOnline: false,
      },
      { new: true },
    );

    if (!request) {
      return res
        .status(400)
        .json({ message: "Already processed or not found" });
    }

    const user = await User.findByIdAndUpdate(
      request.userId,
      { role: "delivery_boy" },
      { new: true },
    );

    if (user?.email) {
      try {
        await sendEmail(
          user.email,
          "🎉 Application Approved",
          `<h2>Congrats ${user.name || "User"} </h2><p>Your delivery partner request has been <b>approved</b>.</p><p>You can now log in and start accepting deliveries.</p><a href="${process.env.CLIENT_URL}/delivery/dashboard" style="display:inline-block;margin-top:12px;padding:10px 16px;background:#105e3f;color:white;text-decoration:none;border-radius:6px;font-weight:600;">Go to Dashboard</a>`,
        );
      } catch (err) {
        console.log("Email failed but approval continues");
      }
    }

    return res.json({ message: "Approved successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};
export const rejectDeliveryBoy = async (req: AuthRequest, res: Response) => {
  try {
    const admin = await User.findById(req.user?.id);

    if (!admin || admin.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only admin can reject requests" });
    }

    const { requestId } = req.params;

    const request = await DeliveryBoy.findOneAndUpdate(
      { _id: requestId, status: "pending" },
      { status: "rejected", isOnline: false, isAvailable: false },
      { new: true },
    );

    if (!request) {
      return res
        .status(400)
        .json({ message: "Already processed or not found" });
    }

    const user = await User.findById(request.userId);

    if (user?.email) {
      try {
        await sendEmail(
          user.email,
          "Application Update",
          `<h2>Hello ${user.name || "User"}</h2><p>We’re sorry 😔</p><p>Your delivery partner request was <b>not approved</b> at this time.</p><p>You can reapply later or contact support.</p><a href="${process.env.CLIENT_URL}/contact" style="display:inline-block;margin-top:12px;padding:10px 16px;background:#e11d48;color:white;text-decoration:none;border-radius:6px;font-weight:600;">Contact Support</a>`,
        );
      } catch (err) {
        console.log("Email failed but rejection continues");
      }
    }

    return res.json({ message: "Rejected successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getDeliveryBoyRequests = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const requests = await DeliveryBoy.find().sort({ createdAt: -1 });

    return res.json(requests);
  } catch (error) {
    console.error("Error fetching requests:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
