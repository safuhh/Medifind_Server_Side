import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { FulfillmentService } from "../../services/fulfillment.service.js";
import { Fulfillment } from "../../models/fulfillment.model.js";
import { User } from "../../models/user.model.js";

export class FulfillmentController {
  /**
   * Evaluates prescription availability and returns optimized split recommendations.
   * POST /api/ai/fulfillment/optimize
   */
  public static async optimizePrescription(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { prescriptionId, patientId, medicines, patientCoords } = req.body;

      if (!prescriptionId || !patientId || !medicines || !Array.isArray(medicines)) {
        res.status(400).json({
          status: "fail",
          message: "Required parameters: prescriptionId, patientId, and medicines (array of strings)",
        });
        return;
      }

      const plan = await FulfillmentService.optimizeFulfillment(
        prescriptionId,
        patientId,
        medicines,
        patientCoords
      );

      res.status(201).json({
        status: "success",
        data: plan,
      });
    } catch (error: any) {
      console.error("AI FULFILLMENT OPTIMIZE ERROR:", error);
      res.status(422).json({
        status: "fail",
        message: error.message,
      });
    }
  }

  /**
   * Retrieves detailed fulfillment splits by prescription ID.
   * GET /api/ai/fulfillment/prescription/:prescriptionId
   */
  public static async getFulfillmentDetails(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { prescriptionId } = req.params;

      const isObjectId = Types.ObjectId.isValid(prescriptionId as string);
      const query: any = isObjectId
        ? { $or: [{ _id: prescriptionId }, { prescriptionId }] }
        : { prescriptionId };

      const plan = await Fulfillment.findOne(query).populate({ path: "splits.pharmacyId", model: User });
      if (!plan) {
        res.status(404).json({
          status: "fail",
          message: "Fulfillment plan not found for this prescription ID",
        });
        return;
      }

      res.status(200).json({
        status: "success",
        data: plan,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Confirms fulfillment and blocks medicine orders.
   * PATCH /api/ai/fulfillment/:id/confirm
   */
  public static async confirmFulfillment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;

      const plan = await Fulfillment.findById(id);
      if (!plan) {
        res.status(404).json({
          status: "fail",
          message: "Fulfillment plan not found",
        });
        return;
      }

      plan.status = "confirmed";
      await plan.save();

      res.status(200).json({
        status: "success",
        message: "Fulfillment plan confirmed successfully",
        data: plan,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Directly calculates optimal splits from provided prescription and inventory lists.
   * POST /api/ai/fulfillment/planner
   */
  public static async planPrescription(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { prescription, pharmacies } = req.body;

      if (!prescription || !Array.isArray(prescription)) {
        res.status(400).json({
          status: "fail",
          message: "Required parameter: 'prescription' must be an array of strings",
        });
        return;
      }

      if (!pharmacies || !Array.isArray(pharmacies)) {
        res.status(400).json({
          status: "fail",
          message: "Required parameter: 'pharmacies' must be an array of pharmacy objects",
        });
        return;
      }

      const planResult = await FulfillmentService.planFulfillment(
        prescription,
        pharmacies
      );

      res.status(200).json(planResult);
    } catch (error: any) {
      res.status(422).json({
        status: "fail",
        message: error.message,
      });
    }
  }
}
