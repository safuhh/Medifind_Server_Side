import { DoctorRepository } from "../repositories/doctor.repository.js";
import { User } from "../models/user.model.js";
import { getAddressFromCoords } from "../utils/geocode.js";
import { sendEmail } from "../utils/sendEmail.js";

const safeJsonParse = (str: unknown) => {
  if (typeof str !== "string") return str;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
};

export class DoctorService {
  static async processApplication(userId: string, user: any, body: any, files: any) {
    if (
      user?.role === "admin" ||
      user?.role === "seller" ||
      user?.role === "delivery_boy" ||
      user?.role === "doctor"
    ) {
      throw new Error("Admins,Sellers,Delivery Boys and Doctors cannot apply for Doctor role");
    }

    const location = safeJsonParse(body.location) || {};
    const qualification = safeJsonParse(body.qualification) || {};

    const experienceYears = Number(body.experienceYears) || 0;
    const consultationFee = Number(body.consultationFee) || 0;

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
      throw new Error("Medical certificate is required");
    }

    if (!body.profileImage && !uploadedProfileFile) {
      throw new Error("Profile image is required");
    }

    const existingApplication = await DoctorRepository.findExistingApplication(userId);
    if (existingApplication) {
      throw new Error("You have already applied for doctor verification");
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
      const regExists = await DoctorRepository.findByRegistrationNumber(registrationNumber);
      if (regExists) {
        throw new Error("Registration number already used");
      }
    }

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

    const application = await DoctorRepository.createApplication(applicationData);
    return application;
  }

  static async getApplicationStatus(userId: string) {
    const application = await DoctorRepository.findExistingApplication(userId);
    return application;
  }

  static async getAllApplications() {
    return await DoctorRepository.getAllApplications();
  }

  static async reviewApplication(id: string, status: string, rejectionReason: string) {
    if (!["approved", "rejected"].includes(status)) {
      throw new Error("Invalid status");
    }

    const application = await DoctorRepository.findApplicationById(id);
    if (!application) {
      throw new Error("Application not found");
    }

    if (application.status !== "pending") {
      throw new Error("Application already processed");
    }

    const user = await User.findById(application.userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (status === "approved") {
      await DoctorRepository.updateUserRole(application.userId.toString(), "doctor");
    }

    application.status = status as any;
    if (status === "rejected") {
      application.rejectionReason = rejectionReason || "Your application did not meet our criteria.";
    }

    await DoctorRepository.saveApplication(application);

    try {
      if (status === "approved") {
        await sendEmail(
          user.email,
          "Doctor Verification Approved",
          `<h2>Congratulations ${application.fullName}!</h2>
           <p>Your doctor verification request has been approved. You can now access doctor features.</p>
           <p><b>Role:</b> Doctor</p>`
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
        </a>`
        );
      }
    } catch (emailError) {
      console.error("Email Sending Failed:", emailError);
    }

    return application;
  }
}
