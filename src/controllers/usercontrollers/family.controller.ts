import { Request, Response } from "express";
import { FamilyMember } from "../../models/familyMember.model.js";
import { User } from "../../models/user.model.js";
import { HealthReport } from "../../models/healthReport.model.js";
import { DoctorBooking } from "../../models/doctor.booking.model.js";
import { Order } from "../../models/order.model.js";
import { EmbeddingService } from "../../services/embedding.service.js";
import { sendEmail } from "../../utils/sendEmail.js";

/**
 * GET /api/family
 * List all family members for the logged-in user.
 */
export const getFamilyMembers = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const members = await FamilyMember.find({ primaryUserId: userId }).sort({ isDefault: -1, createdAt: 1 });
    return res.status(200).json({ success: true, members });
  } catch (error: any) {
    console.error("getFamilyMembers error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch family members" });
  }
};

/**
 * POST /api/family
 * Add a new family member.
 */
export const addFamilyMember = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const {
      name, relationship, dateOfBirth, gender,
      bloodGroup, allergies, chronicDiseases,
      profileImage, emergencyContact, email
    } = req.body;

    if (!name || !relationship) {
      return res.status(400).json({ success: false, message: "Name and relationship are required" });
    }

    // Ensure only one "self" member
    if (relationship === "self") {
      const existingSelf = await FamilyMember.findOne({ primaryUserId: userId, relationship: "self" });
      if (existingSelf) {
        return res.status(400).json({ success: false, message: "A 'self' profile already exists for this account" });
      }
    }

    // Count existing members (max 10)
    const count = await FamilyMember.countDocuments({ primaryUserId: userId });
    if (count >= 10) {
      return res.status(400).json({ success: false, message: "Maximum 10 family members allowed per account" });
    }

    const isDefault = relationship === "self";

    let verificationStatus: "unlinked" | "pending" | "verified" = isDefault ? "verified" : "pending";
    let verificationCode;
    let verificationCodeExpiresAt;

    if (!isDefault) {
      const currentUser = await User.findById(userId);
      if (!currentUser || !currentUser.email) {
        return res.status(400).json({ success: false, message: "No registered email found for this account" });
      }

      verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      verificationCodeExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
      
      // Send OTP email to the currently logged in user
      try {
        const emailSubject = "Verify New Family Member - MediFind";
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #0a4d33;">MediFind Family Hub</h2>
            <p>You are attempting to add a new family member (<strong>${name}</strong>) to your account.</p>
            <p>Please enter the following 6-digit code to securely verify and authorize this action:</p>
            <div style="background-color: #f1f5f9; padding: 20px; text-align: center; border-radius: 12px; margin: 24px 0;">
              <h1 style="letter-spacing: 0.5em; color: #0a4d33; margin: 0; font-size: 32px;">${verificationCode}</h1>
            </div>
            <p style="color: #64748b; font-size: 14px;">This code will expire in 5 minutes.</p>
          </div>
        `;
        await sendEmail(currentUser.email, emailSubject, emailHtml);
      } catch (emailErr: any) {
        console.error("Failed to send OTP email:", emailErr);
        return res.status(500).json({ success: false, message: `Failed to send verification email. Error: ${emailErr.message}` });
      }
    }

    const memberData: any = {
      primaryUserId: userId,
      name,
      relationship,
      dateOfBirth,
      gender,
      bloodGroup,
      allergies: allergies || [],
      chronicDiseases: chronicDiseases || [],
      profileImage,
      emergencyContact,
      isDefault,
      verificationStatus
    };

    if (verificationCode) memberData.verificationCode = verificationCode;
    if (verificationCodeExpiresAt) memberData.verificationCodeExpiresAt = verificationCodeExpiresAt;

    const member = await FamilyMember.create(memberData);

    // Generate embedding for this member's profile in background
    EmbeddingService.indexFamilyMember(member, userId).catch(console.error);

    return res.status(201).json({ success: true, member, requiresVerification: verificationStatus === "pending" });
  } catch (error: any) {
    console.error("addFamilyMember error:", error);
    return res.status(500).json({ success: false, message: "Failed to add family member" });
  }
};

/**
 * POST /api/family/:id/verify
 * Verify a family member using OTP
 */
export const verifyFamilyMember = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: "OTP code is required" });
    }

    const member = await FamilyMember.findOne({ _id: id, primaryUserId: userId });
    
    if (!member) {
      return res.status(404).json({ success: false, message: "Family member not found" });
    }

    if (member.verificationStatus !== "pending") {
      return res.status(400).json({ success: false, message: "Member is not pending verification" });
    }

    if (member.verificationCode !== code) {
      return res.status(400).json({ success: false, message: "Invalid OTP code" });
    }

    if (member.verificationCodeExpiresAt && new Date() > member.verificationCodeExpiresAt) {
      return res.status(400).json({ success: false, message: "OTP code has expired" });
    }

    member.verificationStatus = "verified";
    (member as any).verificationCode = undefined;
    (member as any).verificationCodeExpiresAt = undefined;
    await member.save();

    return res.status(200).json({ success: true, message: "Family member successfully linked!", member });
  } catch (error: any) {
    console.error("verifyFamilyMember error:", error);
    return res.status(500).json({ success: false, message: "Failed to verify family member" });
  }
};

/**
 * POST /api/family/:id/resend-otp
 * Resends the verification OTP
 */
export const resendFamilyMemberOTP = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const currentUser = await User.findById(userId);
    if (!currentUser || !currentUser.email) {
      return res.status(400).json({ success: false, message: "No registered email found for this account" });
    }

    const member = await FamilyMember.findOne({ _id: id, primaryUserId: userId });
    if (!member) {
      return res.status(404).json({ success: false, message: "Family member not found" });
    }

    if (member.verificationStatus !== "pending") {
      return res.status(400).json({ success: false, message: "Member is already verified or unlinked" });
    }

    // Check for cooldown (e.g. at least 60 seconds since last generated)
    // We can infer roughly based on expiry time if it's within 4 minutes of expiry (since it's 5 min total)
    if (member.verificationCodeExpiresAt) {
      const msSinceGenerated = (5 * 60 * 1000) - (member.verificationCodeExpiresAt.getTime() - Date.now());
      if (msSinceGenerated < 60000) {
         return res.status(429).json({ success: false, message: `Please wait before requesting a new OTP.` });
      }
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationCodeExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    try {
      const emailSubject = "Verify New Family Member - MediFind";
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0a4d33;">MediFind Family Hub</h2>
          <p>You requested a new verification code for <strong>${member.name}</strong>.</p>
          <p>Please enter the following 6-digit code to securely verify and authorize this action:</p>
          <div style="background-color: #f1f5f9; padding: 20px; text-align: center; border-radius: 12px; margin: 24px 0;">
            <h1 style="letter-spacing: 0.5em; color: #0a4d33; margin: 0; font-size: 32px;">${verificationCode}</h1>
          </div>
          <p style="color: #64748b; font-size: 14px;">This code will expire in 5 minutes.</p>
        </div>
      `;
      await sendEmail(currentUser.email, emailSubject, emailHtml);
    } catch (emailErr) {
      console.error("Failed to resend OTP email:", emailErr);
      return res.status(500).json({ success: false, message: "Failed to send verification email. Please try again later." });
    }

    member.verificationCode = verificationCode;
    member.verificationCodeExpiresAt = verificationCodeExpiresAt;
    await member.save();

    return res.status(200).json({ success: true, message: "OTP resent successfully." });

  } catch (error: any) {
    console.error("resendFamilyMemberOTP error:", error);
    return res.status(500).json({ success: false, message: "Failed to resend OTP" });
  }
};

/**
 * PATCH /api/family/:id
 * Update a family member's profile.
 */
export const updateFamilyMember = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const updates = req.body;

    // Prevent changing relationship to "self" if another self exists
    if (updates.relationship === "self") {
      const existingSelf = await FamilyMember.findOne({
        primaryUserId: userId,
        relationship: "self",
        _id: { $ne: id }
      });
      if (existingSelf) {
        return res.status(400).json({ success: false, message: "A 'self' profile already exists" });
      }
    }

    const member = await FamilyMember.findOneAndUpdate(
      { _id: id, primaryUserId: userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!member) {
      return res.status(404).json({ success: false, message: "Family member not found" });
    }

    // Re-index the member's embedding
    EmbeddingService.indexFamilyMember(member, userId).catch(console.error);

    return res.status(200).json({ success: true, member });
  } catch (error: any) {
    console.error("updateFamilyMember error:", error);
    return res.status(500).json({ success: false, message: "Failed to update family member" });
  }
};

/**
 * DELETE /api/family/:id
 * Remove a family member.
 */
export const deleteFamilyMember = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const member = await FamilyMember.findOneAndDelete({ _id: id, primaryUserId: userId });
    if (!member) {
      return res.status(404).json({ success: false, message: "Family member not found" });
    }

    if (member.isDefault) {
      return res.status(400).json({ success: false, message: "Cannot delete your primary (self) profile" });
    }

    return res.status(200).json({ success: true, message: "Family member removed" });
  } catch (error: any) {
    console.error("deleteFamilyMember error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete family member" });
  }
};

/**
 * GET /api/family/:id/health-reports
 * Health reports for a specific family member.
 */
export const getFamilyMemberHealthReports = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const member = await FamilyMember.findOne({ _id: id, primaryUserId: userId });
    if (!member) {
      return res.status(403).json({ success: false, message: "Access denied or family member not found" });
    }

    const reports = await HealthReport.find({ familyMemberId: id })
      .populate("doctorId", "fullName specialization profileImage")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, reports, member });
  } catch (error: any) {
    console.error("getFamilyMemberHealthReports error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch health reports" });
  }
};

/**
 * GET /api/family/:id/bookings
 * Appointment history for a specific family member.
 */
export const getFamilyMemberBookings = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const member = await FamilyMember.findOne({ _id: id, primaryUserId: userId });
    if (!member) {
      return res.status(403).json({ success: false, message: "Access denied or family member not found" });
    }

    const bookings = await DoctorBooking.find({ familyMemberId: id, userId })
      .populate("doctorId", "fullName specialization profileImage consultationFee")
      .sort({ date: -1 });

    return res.status(200).json({ success: true, bookings, member });
  } catch (error: any) {
    console.error("getFamilyMemberBookings error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch bookings" });
  }
};

/**
 * GET /api/family/:id/orders
 * Order (medicine purchase) history for a specific family member.
 */
export const getFamilyMemberOrders = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const member = await FamilyMember.findOne({ _id: id, primaryUserId: userId });
    if (!member) {
      return res.status(403).json({ success: false, message: "Access denied or family member not found" });
    }

    const orders = await Order.find({ familyMemberId: id, userId })
      .populate("items.medicineId", "name brand unitWeight")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, orders, member });
  } catch (error: any) {
    console.error("getFamilyMemberOrders error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
};
