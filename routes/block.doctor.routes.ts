import express from "express";
const router = express.Router();
import {
    blockDoctor,
    getAllDoctors,
    unblockDoctor,
} from "../controllers/blockdoctor.controller.js";

router.get("/all-doctors", getAllDoctors);
router.post("/block-doctor/:doctorId", blockDoctor);
router.post("/unblock-doctor/:doctorId", unblockDoctor);

export default router;