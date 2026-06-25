import { Router } from "express";
import { PharmacyController } from "../../controllers/aicontrollers/pharmacy.controller.js";

const router = Router();

// Endpoint to seed mock pharmacies and inventories
router.post("/seed", PharmacyController.seedFulfillmentData);

// Endpoint to get all registered pharmacies
router.get("/", PharmacyController.getAllPharmacies);

export default router;
