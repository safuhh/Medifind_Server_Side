import { Response } from "express";
import { AuthRequest } from "../types/authRequest.js";
import { User } from "../models/user.model.js";
import { SellerRequest } from "../models/sellerRequest.model.js";
import { sendEmail } from "../utils/sendEmail.js";

export const approveseller = async (req: AuthRequest, res: Response) => {
  try {
    const { requestId } = req.params;

    const request = await SellerRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Request already processed" });
    }

    const user = await User.findById(request.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "admin") {
      return res.status(400).json({
        message: "Admin cannot become a seller",
      });
    }

    request.status = "approved";
    await request.save();

    user.role = "seller";
    await user.save();

    const updatedUser = await User.findById(user._id).select("-password");

    await sendEmail(
      user.email,
      "Seller Request Approved",
      `
        <h2>Hi ${user.name}</h2>
        <p>Your seller request has been <b>approved</b>.</p>
        <p>You are now a <b>Seller</b></p>
      `
    );

    return res.json({
      message: "Seller request approved & email sent",
      user: updatedUser,
    });

  } catch (error) {
    console.error("Error in approveseller:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
export const rejectSeller = async (req: AuthRequest, res: Response) => {
  try {
    const { requestId } = req.params;

    const request = await SellerRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Request already processed" });
    }

    const user = await User.findById(request.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    request.status = "rejected";
    await request.save();

    try {
      await sendEmail(
        user.email,
        "Seller Request Rejected ",
        `
          <h2>Hi ${user.name}</h2>
          <p>Unfortunately, your seller request has been <b>rejected</b>.</p>
          <p>You can update your details and apply again.</p>

          <a href="${process.env.CLIENT_URL}/seller/sellerform"
            style="
              display:inline-block;
              margin-top:10px;
              padding:10px 20px;
              background:#dc2626;
              color:white;
              text-decoration:none;
              border-radius:6px;
            ">
            Apply Again
          </a>
        `
      );
    } catch (err) {
      console.log("Email failed, but rejection saved");
    }

    res.json({ message: "Seller request rejected & email sent" });

  } catch (error) {
    console.error("Error in rejectSeller:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getSellerRequests = async (req: AuthRequest, res: Response) => {
  try {
    const requests = await SellerRequest.find().sort({ createdAt: -1 });
    console.log("REQUESTS:", requests);
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
