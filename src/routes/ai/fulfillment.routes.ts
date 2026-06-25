import { Router } from "express";
import { FulfillmentController } from "../../controllers/aicontrollers/fulfillment.controller.js";

const router = Router();

// Endpoint to compute optimal pharmacy splits
router.post("/optimize", FulfillmentController.optimizePrescription);

// Endpoint for direct pharmacy fulfillment planner
router.post("/planner", FulfillmentController.planPrescription);

// Endpoint to fetch splits details by prescriptionId
router.get("/prescription/:prescriptionId", FulfillmentController.getFulfillmentDetails);

// Endpoint to confirm a split plan
router.patch("/:id/confirm", FulfillmentController.confirmFulfillment);

export default router;
