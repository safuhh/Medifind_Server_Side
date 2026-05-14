import { Request, Response } from "express";
import { DoctorApplication } from "../models/doctor.model.js";

const safeJsonParse = (str: string) => {
    try {
        return str && typeof str === "string" ? JSON.parse(str) : str;
    } catch (e) {
        return null;
    }
};

export const getDoctorsBySpecialization = async (req: Request, res: Response) => {
  try {
    const { specialization } = req.query;
    const query = specialization ? { specialization } : {};
    const doctors = await DoctorApplication.find(query).populate("userId", "-password");
    
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

    parsedLocation = safeJsonParse(parsedLocation);
    parsedQualification = safeJsonParse(parsedQualification);

    const {
      fullName,
      phone,
      email,
      address,
      experienceYears,
      specialization,
      consultationFee,
      registrationNumber,
      medicalCouncil
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
    
    if (registrationNumber && registrationNumber !== doctor.registrationNumber) {
        const regExists = await DoctorApplication.findOne({ registrationNumber, userId: { $ne: userId } });
        if (regExists) {
            return res.status(400).json({ success: false, message: "Registration number already used by another doctor" });
        }
        doctor.registrationNumber = registrationNumber;
    }
    
    if (medicalCouncil) doctor.medicalCouncil = medicalCouncil;
    
    if (parsedLocation && parsedLocation.coordinates) {
        doctor.location = parsedLocation;
    }
    
    if (parsedQualification) {
        doctor.qualification = {
            degree: parsedQualification.degree || doctor.qualification.degree,
            collegeName: parsedQualification.collegeName || doctor.qualification.collegeName,
            university: parsedQualification.university || doctor.qualification.university,
            certificateUrl: doctor.qualification.certificateUrl
        };
    }

    if (uploadedProfileFile) {
        doctor.profileImage = uploadedProfileFile.path;
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
