import express from "express";
import {
  getMedicineById,
  getAllMedicines,
  deleteMedicine,
  getSellerMedicines as getMedicines,
  createMedicine,
  updateMedicine,
} from "../controllers/usercontrollers/medicine.controller.js";

import { protect, optionalProtect } from "../middlewares/auth.middleware.js";
import { checksubcription } from "../middlewares/checkSubscription.js";
import { upload } from "../middlewares/upload.js";
const router = express.Router();

console.log("MEDICINE ROUTES REGISTERING...");
router.get("/all", optionalProtect, getAllMedicines); // Public route

router.get("/:id", getMedicineById); // Public route
router.use(protect); // 🔥 all following route
router.post("/", upload.array("images", 10), checksubcription, createMedicine);
router.get("/", getMedicines);
router.put("/:id", upload.array("images", 10), updateMedicine);
router.delete("/:id", deleteMedicine);

export default router;
