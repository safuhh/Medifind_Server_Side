import { Router } from "express";
import { getAddressFromCoords } from "../utils/geocode.js";

const router = Router();
console.log(">>> Location Routes File Executed");

router.get("/reverse", async (req, res) => {
  try {
    console.log(">>> REVERSE ROUTE HIT:", req.query);
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ message: "Latitude and longitude are required" });
    }

    const data = await getAddressFromCoords(Number(lat), Number(lng));
    console.log(">>> GEO DATA RETURNED:", data.shortName);

    return res.json({
      address: data.fullAddress || data.shortName || "Address not found",
      shortName: data.shortName
    });
  } catch (error) {
    console.error("Reverse geocode error:", error);
    return res.status(500).json({ message: "Error fetching address" });
  }
});

export default router;
