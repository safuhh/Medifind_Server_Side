import express from "express";
import {
deleteMedicine,
getMedicineById,
getMedicines,
createMedicine,
updateMedicine,
getAllMedicines,
getMedicineByBarcode,
} from "../controllers/medicine.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import {upload} from "../middleware/upload.js";
const router = express.Router();

console.log("MEDICINE ROUTES REGISTERING...");
router.get("/all", getAllMedicines); // Public route
router.get("/barcode/:barcode", getMedicineByBarcode); // Public route
router.get("/:id", getMedicineById); // Public route
router.use(protect); // 🔥 all following routes protected
router.post("/", upload.array("images", 10), createMedicine);
router.get("/", getMedicines);
router.put("/:id", upload.array("images", 10), updateMedicine);
router.delete("/:id", deleteMedicine);

export default router;