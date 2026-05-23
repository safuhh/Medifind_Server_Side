import express from "express";
const router = express.Router();
import {
    blockDoctor,
    getAllDoctors,
    unblockDoctor,
} from "../controllers/admincontroller/blockdoctor.controller.js";
import { protect, authorizeRoles } from "../middleware/auth.middleware.js";

router.use(protect);
router.use(authorizeRoles("admin"));

router.get("/all-doctors", getAllDoctors);
router.post("/block-doctor/:doctorId", blockDoctor);
router.post("/unblock-doctor/:doctorId", unblockDoctor);

export default router;