import { Request, Response } from "express";
import { AuthRequest } from "../../types/authRequest.js";
import { User } from "../../models/user.model.js";
import { DoctorService } from "../../services/doctor.service.js";

interface ApplyDoctorRequest extends AuthRequest {
  files?: any;
}

export const applyDoctor = async (req: ApplyDoctorRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await User.findById(userId);

    const application = await DoctorService.processApplication(userId, user, req.body, req.files);

    return res.status(201).json({
      success: true,
      message: "Doctor application submitted successfully",
      data: application,
    });
  } catch (error: any) {
    console.error(">>> APPLY DOCTOR ERROR DETAILS:", error);

    if (error.name === "ValidationError") {
      console.error("DOCTOR VALIDATION ERRORS:", error.errors);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: Object.keys(error.errors).map((key) => ({
          field: key,
          message: error.errors[key].message,
        })),
      });
    }

    // Specific business logic errors
    if (error.message === "Medical certificate is required" || error.message === "Profile image is required" || error.message === "You have already applied for doctor verification" || error.message === "Registration number already used" || error.message.includes("cannot apply")) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export const getApplicationStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const application = await DoctorService.getApplicationStatus(userId);

    if (!application) {
      return res.status(200).json({
        success: true,
        application: null,
        message: "No application found for this user",
      });
    }

    return res.json({
      success: true,
      status: application.status,
      application,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getAllDoctorApplications = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const applications = await DoctorService.getAllApplications();
    console.log(`>>> Admin Fetched ${applications.length} doctor applications`);
    return res.json({
      success: true,
      count: applications.length,
      applications,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const reviewDoctorApplication = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    const application = await DoctorService.reviewApplication(id as string, status, rejectionReason);

    return res.json({
      success: true,
      message: `Application ${status} successfully`,
      application,
    });
  } catch (error: any) {
    console.error("Review Doctor Error:", error);

    if (error.message === "Invalid status" || error.message === "Application not found" || error.message === "Application already processed" || error.message === "User not found") {
        return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
