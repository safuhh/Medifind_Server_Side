import express from "express";
const router = express.Router();
import {
    blockDoctor,
    getAllDoctors,
    unblockDoctor,
} from "../controllers/admincontroller/admin.user.controller.js";
import { protect, authorizeRoles } from "../middlewares/auth.middleware.js";

router.use(protect);
router.use(authorizeRoles("admin"));

router.get("/all-doctors", getAllDoctors);
router.post("/block-doctor/:doctorId", blockDoctor);
router.post("/unblock-doctor/:doctorId", unblockDoctor);

export default router;
