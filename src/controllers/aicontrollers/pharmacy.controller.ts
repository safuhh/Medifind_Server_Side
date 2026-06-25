import { Request, Response, NextFunction } from "express";
import { Pharmacy } from "../../models/pharmacy.model.js"; // Re-exported User

export class PharmacyController {
  /**
   * Seeding is deprecated because the service connects directly to the main database.
   * POST /api/ai/pharmacy/seed
   */
  public static async seedFulfillmentData(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    res.status(400).json({
      status: "fail",
      message: "Seeding is deprecated. The microservice is directly connected to the main database.",
    });
  }

  /**
   * Retrieves all active pharmacies (sellers) from the main database.
   * GET /api/ai/pharmacy
   */
  public static async getAllPharmacies(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const pharmacies = await Pharmacy.find({ role: "seller", isBlocked: false });
      res.status(200).json({
        status: "success",
        results: pharmacies.length,
        data: { pharmacies },
      });
    } catch (error) {
      next(error);
    }
  }
}
