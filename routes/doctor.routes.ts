import { Router } from "express";
import { 
    getDoctorsBySpecialization,
    getSingleDoctor,
    updateDoctorProfile,
    getNearbyDoctors,
    submitDoctorReview,
    getDoctorReviews
} from "../controllers/doctorcontroller/doctor.controller.js";

import { 
    applyDoctor, 
    getApplicationStatus, 
    getAllDoctorApplications, 
    reviewDoctorApplication,
} from "../controllers/admincontroller/doctorApplication.controller.js";
import { protect, authorizeRoles } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.js";

const router = Router();

// Test Route
router.get("/test", (req, res) => {
    res.json({ message: "Doctor routes are active" });
});

// User Routes
router.post(
    "/apply", 
    protect, 
    upload.fields([
        { name: 'certificate', maxCount: 1 },
        { name: 'selfie', maxCount: 1 },
        { name: 'profileImageFile', maxCount: 1 }
    ]), 
    applyDoctor
);

router.put(
    "/profile-update",
    protect,
    authorizeRoles("doctor"),
    upload.fields([
        { name: 'profileImageFile', maxCount: 1 }
    ]),
    updateDoctorProfile
);

router.get("/status", protect, getApplicationStatus);
router.get("/all", protect, getDoctorsBySpecialization);
router.get("/profile/:id", getSingleDoctor);
router.get("/nearby", protect, getNearbyDoctors);
router.post("/review", protect, submitDoctorReview);
router.get("/reviews/:doctorId", getDoctorReviews);

// Admin Routes
router.get("/admin/applications", protect, authorizeRoles("admin"), getAllDoctorApplications);
router.put("/admin/review/:id", protect, authorizeRoles("admin"), reviewDoctorApplication);

export default router;
