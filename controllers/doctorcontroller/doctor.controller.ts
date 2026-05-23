import { Request, Response } from "express";
import { DoctorApplication } from "../../models/doctor.model.js";
import { User } from "../../models/user.model.js";
import DoctorAvailability from "../../models/doctor.availbilty.model.js";
import { DoctorReview } from "../../models/doctorReview.model.js";
import { DoctorBooking } from "../../models/doctor.booking.model.js";
import { calculateDistance } from "../../utils/geocode.js";

const safeJsonParse = (str: string) => {
    try {
        return str && typeof str === "string" ? JSON.parse(str) : str;
    } catch (e) {
        return null;
    }
};

export const getDoctorsBySpecialization = async (req: any, res: Response) => {
  try {
    const { specialization } = req.query;
    let lat = req.query.lat ? Number(req.query.lat) : null;
    let lng = req.query.lng ? Number(req.query.lng) : null;

    // Fallback to user's saved location if authenticated and lat/lng not provided
    if ((lat === null || lng === null) && req.user?.id) {
      const user = await User.findById(req.user.id);
      if (user?.location?.coordinates && user.location.coordinates.length === 2) {
        lng = user.location.coordinates[0];
        lat = user.location.coordinates[1];
      }
    }

    // Default fallback coordinates if still null
    if (lat === null || lng === null) {
      lat = 19.0760;
      lng = 72.8777;
    }

    const query: any = { status: "approved" };
    if (specialization) {
      query.specialization = specialization as string;
    }

    const doctors = await DoctorApplication.find(query).populate("userId", "-password");

    // Fetch availability indicators for each doctor
    const doctorAvailabilities = await DoctorAvailability.find({});
    const availMap = new Map<string, any>();
    for (const avail of doctorAvailabilities) {
      if ((avail as any).doctor_id) {
        availMap.set((avail as any).doctor_id.toString(), avail);
      }
    }

    // Map and calculate distance
    const doctorsWithDetails = doctors.map((doc: any) => {
      let distance = Infinity;
      if (doc.location?.coordinates && doc.location.coordinates.length === 2) {
        const docLng = doc.location.coordinates[0];
        const docLat = doc.location.coordinates[1];
        distance = calculateDistance(lat!, lng!, docLat, docLng);
      }

      // Check weekly availability
      const avail = availMap.get(doc._id.toString());
      let isAvailable = false;
      if (avail?.weeklyavailability) {
        const weekly = avail.weeklyavailability;
        isAvailable = Object.values(weekly).some(val => val === true);
      }

      return {
        ...doc.toObject(),
        distance: distance !== Infinity ? Number(distance.toFixed(2)) : null,
        isAvailable,
      };
    });

    // Filter to only include nearby doctors (distance <= 50 km)
    const MAX_DISTANCE_KM = 50;
    const nearbyDoctors = doctorsWithDetails.filter(
      (doc) => doc.distance !== null && doc.distance <= MAX_DISTANCE_KM
    );

    // Sort by proximity: closest first
    nearbyDoctors.sort((a, b) => {
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance! - b.distance!;
    });

    res.json({ success: true, doctors: nearbyDoctors });
  } catch (error: any) {
    console.error("Error fetching doctors by specialization:", error);
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

export const getNearbyDoctors = async (req: any, res: Response) => {
  try {
    let lat = req.query.lat ? Number(req.query.lat) : null;
    let lng = req.query.lng ? Number(req.query.lng) : null;

    // Fallback to user's saved location
    if ((lat === null || lng === null) && req.user?.id) {
      const user = await User.findById(req.user.id);
      if (user?.location?.coordinates && user.location.coordinates.length === 2) {
        lng = user.location.coordinates[0];
        lat = user.location.coordinates[1];
      }
    }

    // Default fallback coordinates if still null
    if (lat === null || lng === null) {
      lat = 19.0760;
      lng = 72.8777;
    }

    // Find all approved doctors
    const doctors = await DoctorApplication.find({ status: "approved" }).populate("userId", "-password");

    // Fetch availability indicators for each doctor
    const doctorAvailabilities = await DoctorAvailability.find({});
    const availMap = new Map<string, any>();
    for (const avail of doctorAvailabilities) {
      if ((avail as any).doctor_id) {
        availMap.set((avail as any).doctor_id.toString(), avail);
      }
    }

    // Map and calculate distance
    const doctorsWithDetails = doctors.map((doc: any) => {
      let distance = Infinity;
      if (doc.location?.coordinates && doc.location.coordinates.length === 2) {
        // [longitude, latitude]
        const docLng = doc.location.coordinates[0];
        const docLat = doc.location.coordinates[1];
        distance = calculateDistance(lat!, lng!, docLat, docLng);
      }

      // Check weekly availability
      const avail = availMap.get(doc._id.toString());
      let isAvailable = false;
      if (avail?.weeklyavailability) {
        const weekly = avail.weeklyavailability;
        isAvailable = Object.values(weekly).some(val => val === true);
      }

      return {
        ...doc.toObject(),
        distance: distance !== Infinity ? Number(distance.toFixed(2)) : null,
        isAvailable,
      };
    });

    // Sort by proximity: closest first
    doctorsWithDetails.sort((a, b) => {
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });

    res.json({ success: true, doctors: doctorsWithDetails });
  } catch (error: any) {
    console.error("Error in getNearbyDoctors:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const submitDoctorReview = async (req: any, res: Response) => {
  try {
    const { doctorId, rating, reviewText, bookingId } = req.body;
    const userId = req.user.id;

    if (!doctorId || !rating) {
      return res.status(400).json({ success: false, message: "Doctor ID and rating are required." });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5." });
    }

    // Verify booking if provided
    if (bookingId) {
      const booking = await DoctorBooking.findOne({ _id: bookingId, userId, doctorId });
      if (!booking) {
        return res.status(400).json({ success: false, message: "Invalid booking references." });
      }
    }

    let review;
    if (bookingId) {
      review = await DoctorReview.findOne({ bookingId, userId });
      if (review) {
        review.rating = rating;
        review.reviewText = reviewText;
        await review.save();
      } else {
        review = await DoctorReview.create({
          doctorId,
          userId,
          bookingId,
          rating,
          reviewText,
        });
      }
    } else {
      review = await DoctorReview.findOneAndUpdate(
        { doctorId, userId },
        { rating, reviewText },
        { new: true, upsert: true }
      );
    }

    // Recalculate average rating for the doctor
    const reviews = await DoctorReview.find({ doctorId });
    const count = reviews.length;
    const avg = count > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0;

    await DoctorApplication.findByIdAndUpdate(doctorId, {
      rating: Number(avg.toFixed(2)),
      ratingCount: count,
    });

    res.json({ success: true, message: "Review submitted successfully!", review });
  } catch (error: any) {
    console.error("Error submitting doctor review:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getDoctorReviews = async (req: Request, res: Response) => {
  try {
    const { doctorId } = req.params;
    const reviews = await DoctorReview.find({ doctorId: doctorId as any })
      .populate("userId", "name image")
      .sort({ createdAt: -1 });

    res.json({ success: true, reviews });
  } catch (error: any) {
    console.error("Error fetching doctor reviews:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
