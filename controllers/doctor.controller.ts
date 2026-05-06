import { Request, Response } from "express";
import { DoctorApplication } from "../models/doctor.model.js";
import { AuthRequest } from "../types/authRequest.js";
import { User } from "../models/user.model.js";
import { sendEmail } from "../utils/sendEmail.js";
import { doctorApplicationSchema } from "../validators/doctor.validator.js";

export const applyDoctor = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await User.findById(userId);
    if (
      user?.role === "admin" ||
      user?.role === "seller" ||
      user?.role === "delivery_boy"
    ) {
      return res.status(403).json({
        success: false,
        message: "Admins, Sellers, and Delivery Boys cannot apply for Doctor role",
      });
    }

    let bodyData = { ...req.body };
    console.log(">>> Body Data Received:", JSON.stringify(bodyData, null, 2));

    let parsedLocation = bodyData.location;
    let parsedQualification = bodyData.qualification;

    try {
      if (typeof parsedLocation === "string")
        parsedLocation = JSON.parse(parsedLocation);
      if (typeof parsedQualification === "string")
        parsedQualification = JSON.parse(parsedQualification);
        
      if (parsedLocation && Array.isArray(parsedLocation.coordinates)) {
        parsedLocation.coordinates = parsedLocation.coordinates.map((c: any) => {
            const num = Number(c);
            return isNaN(num) ? 0 : num;
        });
      }
    } catch (parseErr) {
      console.error("JSON Parse Error:", parseErr);
      return res
        .status(400)
        .json({
          success: false,
          message: "Invalid JSON in location or qualification",
        });
    }

    const {
      fullName,
      phone,
      email,
      address,
      registrationNumber,
      medicalCouncil,
      experienceYears,
      specialization,
      profileImage,
      consultationFee,
    } = bodyData;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    console.log(">>> Files Received:", files ? Object.keys(files) : "None");

    const certificateFile = files?.["certificate"]?.[0];
    const selfieFile = files?.["selfie"]?.[0];
    const uploadedProfileFile = files?.["profileImageFile"]?.[0];

    if (!certificateFile) {
      return res
        .status(400)
        .json({ success: false, message: "Medical certificate is required" });
    }

    const existingApplication = await DoctorApplication.findOne({ userId });
    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: "You have already applied for doctor verification",
      });
    }

    const regExists = await DoctorApplication.findOne({ registrationNumber });
    if (regExists && registrationNumber && registrationNumber !== "N/A") {
      return res.status(400).json({
        success: false,
        message: "Registration number already used",
      });
    }

    console.log(">>> Attempting to create Doctor Application for:", fullName);

    const applicationData = {
      userId,
      fullName: fullName || user?.name,
      phone: phone || user?.phone || "N/A",
      email: email || user?.email,
      address: address || bodyData.address || "N/A",
      location: parsedLocation || { type: "Point", coordinates: [0, 0] },
      qualification: {
        degree: parsedQualification?.degree || "N/A",
        collegeName: parsedQualification?.collegeName || "N/A",
        university: parsedQualification?.university || "N/A",
        certificateUrl: `/uploads/${certificateFile.filename}`,
      },
      registrationNumber: registrationNumber || "N/A",
      medicalCouncil: medicalCouncil || "N/A",
      experienceYears: isNaN(Number(experienceYears)) ? 0 : Number(experienceYears),
      specialization: specialization || "General Physician",
      profileImage: uploadedProfileFile 
        ? `/uploads/${uploadedProfileFile.filename}` 
        : (profileImage || user?.image || "https://api.dicebear.com/7.x/avataaars/svg?seed=doctor"),
      selfieWithId: selfieFile ? `/uploads/${selfieFile.filename}` : undefined,
      consultationFee: isNaN(Number(consultationFee)) ? 0 : Number(consultationFee),
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
    console.error(">>> APPLY DOCTOR ERROR DETAILS:", {
      message: error.message,
      stack: error.stack,
      errors: error.errors 
    });

    // If it's a Mongoose validation error, return 400 instead of 500
    if (error.name === "ValidationError") {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: Object.keys(error.errors).map(key => ({
                field: key,
                message: error.errors[key].message
            }))
        });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
      error: error,
      stack: error.stack,
      details: "Full error exposed for debugging"
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

    // Use validateBeforeSave: false to allow updates even if legacy fields (like specialization)
    // in the document don't match the new strict enum validation.
    await application.save({ validateBeforeSave: false });

    try {
      if (status === "approved") {
        // Send Approval Email
        await sendEmail(
          user.email,
          "Doctor Verification Approved",
          `<h2>Congratulations ${application.fullName}!</h2>
           <p>Your doctor verification request has been approved. You can now access doctor features.</p>
           <p><b>Role:</b> Doctor</p>`,
        );
      } else {
        // Send Rejection Email
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

export const getDoctorsBySpecialization = async (req: Request, res: Response) => {
  try {
    const { specialization } = req.query;
    console.log(">>> QUERY RECEIVED:", req.query);
    console.log(">>> Fetching doctors for specialization:", specialization);
    
    // Temporarily removing status filter to see if any doctors exist
    const query = specialization ? { specialization } : {};
    console.log(">>> Mongoose Query:", JSON.stringify(query));

    const doctors = await DoctorApplication.find(query).populate("userId", "-password");

    console.log(`>>> Total doctors found in DB: ${doctors.length}`);
    doctors.forEach((d, i) => {
      console.log(`>>> Doctor ${i}: ${d.fullName} | Status: ${d.status} | Spec: ${d.specialization}`);
    });
    
    res.json({ success: true, doctors });
  } catch (error: any) {
    console.error("Error fetching doctors:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getSingleDoctor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const doctor = await DoctorApplication.findById(id).populate("userId", "-password");

    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    res.json({ success: true, doctor });
  } catch (error: any) {
    console.error("Error fetching single doctor:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateDoctorProfile = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const doctor = await DoctorApplication.findOne({ userId });
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor profile not found" });
    }

    let bodyData = { ...req.body };
    let parsedLocation = bodyData.location;
    let parsedQualification = bodyData.qualification;

    try {
      if (typeof parsedLocation === "string" && parsedLocation !== "undefined") parsedLocation = JSON.parse(parsedLocation);
      if (typeof parsedQualification === "string" && parsedQualification !== "undefined") parsedQualification = JSON.parse(parsedQualification);
    } catch (parseErr) {
      console.log("Parse error in updateDoctorProfile:", parseErr);
    }

    const {
      fullName,
      phone,
      email,
      address,
      experienceYears,
      specialization,
      consultationFee,
    } = bodyData;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const uploadedProfileFile = files?.["profileImageFile"]?.[0];

    // Update fields
    if (fullName) doctor.fullName = fullName;
    if (phone) doctor.phone = phone;
    if (email) doctor.email = email;
    if (address) doctor.address = address;
    if (experienceYears !== undefined) doctor.experienceYears = Number(experienceYears);
    if (specialization) doctor.specialization = specialization;
    if (consultationFee !== undefined) doctor.consultationFee = Number(consultationFee);
    
    if (parsedLocation && parsedLocation.coordinates) {
        doctor.location = parsedLocation;
    }
    
    if (parsedQualification) {
        doctor.qualification = {
            degree: parsedQualification.degree || doctor.qualification.degree,
            collegeName: parsedQualification.collegeName || doctor.qualification.collegeName,
            university: parsedQualification.university || doctor.qualification.university,
            certificateUrl: doctor.qualification.certificateUrl // Don't allow updating certificate URL easily here
        };
    }

    if (uploadedProfileFile) {
        doctor.profileImage = `/uploads/${uploadedProfileFile.filename}`;
    }

    await doctor.save({ validateBeforeSave: false });

    return res.json({
      success: true,
      message: "Doctor profile updated successfully",
      doctor,
    });
  } catch (error: any) {
    console.error("Update Doctor Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};
