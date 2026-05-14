import { Request, Response } from "express";
import { DoctorApplication } from "../models/doctor.model.js";
import { AuthRequest } from "../types/authRequest.js";
import { User } from "../models/user.model.js";
import { sendEmail } from "../utils/sendEmail.js";
import { getAddressFromCoords } from "../utils/geocode.js";

const safeJsonParse = (str: unknown) => {
  if (typeof str !== "string") return str;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
};

interface ApplyDoctorRequest extends AuthRequest {
  files?: {
    [fieldname: string]: Express.Multer.File[];
  };
}

export const applyDoctor = async (req: ApplyDoctorRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await User.findById(userId);
    if (
      user?.role === "admin" ||
      user?.role === "seller" ||
      user?.role === "delivery_boy"||
      user?.role === "doctor" 
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Admins,Sellers,Delivery Boys and Doctors cannot apply for Doctor role",
      });
    }

    const { body, files } = req;
    console.log(" Body Data Received:", JSON.stringify(body, null, 2));

    // Parse JSON strings from multipart form data
    const location = safeJsonParse(body.location) || {};
    const qualification = safeJsonParse(body.qualification) || {};

    const experienceYears = Number(body.experienceYears) || 0;
    const consultationFee = Number(body.consultationFee) || 0;

    // Ensure coordinates are valid numbers and fetch address if available
    if (Array.isArray(location.coordinates)) {
      location.coordinates = location.coordinates.map((c: any) => Number(c) || 0);

      const [lng, lat] = location.coordinates;
      if (lat && lng) {
        try {
          const geoData = await getAddressFromCoords(lat, lng);
          location.shortName = geoData.shortName;
          location.fullAddress = geoData.fullAddress;
        } catch (err) {
          console.error("Geocoding failed in applyDoctor:", err);
        }
      }
    }

    const certificateFile = files?.["certificate"]?.[0];
    const selfieFile = files?.["selfie"]?.[0];
    const uploadedProfileFile = files?.["profileImageFile"]?.[0];

    if (!certificateFile) {
      return res
        .status(400)
        .json({ success: false, message: "Medical certificate is required" });
    }

    if (!body.profileImage && !uploadedProfileFile) {
      return res
        .status(400)
        .json({ success: false, message: "Profile image is required" });
    }

    const existingApplication = await DoctorApplication.findOne({ userId });
    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: "You have already applied for doctor verification",
      });
    }

    const {
      registrationNumber,
      fullName,
      phone,
      email,
      address,
      medicalCouncil,
      specialization,
    } = body;

    let finalAddress = address || location?.fullAddress || location?.shortName;

    if (registrationNumber && registrationNumber !== "N/A") {
      const regExists = await DoctorApplication.findOne({ registrationNumber });
      if (regExists) {
        return res.status(400).json({
          success: false,
          message: "Registration number already used",
        });
      }
    }

    console.log(">>> Attempting to create Doctor Application for:", fullName);

    const applicationData = {
      userId,
      fullName: fullName || user?.name,
      phone: phone || user?.phone,
      email: email || user?.email,
      address: finalAddress || address,
      location,
      qualification: {
        degree: qualification?.degree,
        collegeName: qualification?.collegeName,
        university: qualification?.university,
        certificateUrl: certificateFile.path,
      },
      registrationNumber,
      medicalCouncil,
      experienceYears,
      specialization,
      profileImage: uploadedProfileFile?.path || body.profileImage || user?.image,
      selfieWithId: selfieFile?.path,
      consultationFee,
      status: "pending",
    };

    const application = await DoctorApplication.create(applicationData);

    console.log(">>> Application Created Successfully:", application._id);

    return res.status(201).json({
      success: true,
      message: "Doctor application submitted successfully",
      data: application,
    });
  } catch (error: any) {
    console.error(">>> APPLY DOCTOR ERROR DETAILS:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: Object.keys(error.errors).map((key) => ({
          field: key,
          message: error.errors[key].message,
        })),
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
    const application = await DoctorApplication.findOne({ userId });

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
    const applications = await DoctorApplication.find().sort({ createdAt: -1 });
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

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const application = await DoctorApplication.findById(id);
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (application.status !== "pending") {
      return res.status(400).json({ message: "Application already processed" });
    }

    const user = await User.findById(application.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (status === "approved") {
      user.role = "doctor";
      await user.save();
    }

    application.status = status;
    if (status === "rejected") {
      application.rejectionReason =
        rejectionReason || "Your application did not meet our criteria.";
    }

    await application.save({ validateBeforeSave: false });

    try {
      if (status === "approved") {
        await sendEmail(
          user.email,
          "Doctor Verification Approved",
          `<h2>Congratulations ${application.fullName}!</h2>
           <p>Your doctor verification request has been approved. You can now access doctor features.</p>
           <p><b>Role:</b> Doctor</p>`,
        );
      } else {
        await sendEmail(
          user.email,
          "Doctor Verification Update",
          `<h2>Hello ${application.fullName},</h2>
           <p>Your doctor verification request was unfortunately rejected.</p>
           <p><b>Reason:</b> ${application.rejectionReason}</p>
           <p>You can re-apply with corrected information if needed.</p>
            <a href="${process.env.CLIENT_URL}/doctor/dashboard"
          style="
            display:inline-block;
            margin-top:10px;
            padding:10px 20px;
            background:green;
            color:white;
            text-decoration:none;
            border-radius:6px;
          ">
          Go to Doctor Dashboard
        </a>`,
        );
      }
    } catch (emailError) {
      console.error("Email Sending Failed:", emailError);
    }

    return res.json({
      success: true,
      message: `Application ${status} successfully`,
      application,
    });
  } catch (error: any) {
    console.error("Review Doctor Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
