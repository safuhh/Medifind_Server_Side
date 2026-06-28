import { Medicine } from "../models/medicine.model.js";
import { Pharmacy } from "../models/pharmacy.model.js"; // Re-exported User
import { Fulfillment, IFulfillment } from "../models/fulfillment.model.js";

import { Types } from "mongoose";
import { HealthReport } from "../models/healthReport.model.js";
import { Cart } from "../models/cart.model.js";

// Haversine distance utility
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Regex escape utility to prevent injection
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class FulfillmentService {
  /**
   * Generates an optimal split plan mapping medicines to the minimum number of pharmacies.
   * Ties are broken by distance. Returns both the splits and unavailable items.
   */
  public static async optimizeFulfillment(
    prescriptionId: string,
    patientId: string,
    medicinesList: string[],
    patientCoords?: [number, number],
  ): Promise<IFulfillment> {
    if (!medicinesList || medicinesList.length === 0) {
      throw new Error("Prescription medicine list cannot be empty");
    }

    // 1. Resolve patient coordinates
    let resolvedPatientCoords: [number, number] = patientCoords || [
      72.8777, 19.076,
    ]; // Fallback coordinates
    if (!patientCoords && patientId) {
      try {
        const patient = await Pharmacy.findById(patientId); // Query main DB User
        if (
          patient &&
          patient.location &&
          patient.location.coordinates &&
          patient.location.coordinates.length === 2
        ) {
          // MongoDB coordinates: [lng, lat]
          resolvedPatientCoords = [
            patient.location.coordinates[1],
            patient.location.coordinates[0],
          ]; // [lat, lng]
        }
      } catch (err) {
        console.error(
          "⚠️ Failed to load patient location from DB, using defaults:",
          err,
        );
      }
    }

    // Normalize medicinesList to handle both array of strings and array of objects
    const normalizedMedicines: Array<{ name: string; quantity: number }> =
      medicinesList
        .map((item: any) => {
          if (typeof item === "string") {
            return { name: item, quantity: 1 };
          } else if (item && typeof item === "object" && item.name) {
            return { name: item.name, quantity: Number(item.quantity) || 1 };
          }
          return { name: "", quantity: 1 };
        })
        .filter((item) => item.name !== "");

    // 2. Resolve medicines and load live catalog matches from the main database
    const resolvedMeds = normalizedMedicines.map((m) => {
      return {
        originalName: m.name,
        genericName: m.name, // Since we don't resolve to generic, just use the original name
        quantity: m.quantity,
      };
    });

    // Fetch all active medicines with stock from main database
    const allActiveMeds = await Medicine.find({
      isActive: true,
      stock: { $gt: 0 },
    });

    // Pre-resolve all active medicines' names and genericNames
    const resolvedActiveMeds = allActiveMeds.map((m) => {
      return {
        medicine: m,
        resolvedName: m.name,
        resolvedGeneric: m.genericName || m.name,
      };
    });

    // Map to hold providers for each requested medicine
    const medicineToPharmaciesMap = new Map<
      string,
      Array<{
        pharmacyId: string;
        pharmacyName: string;
        pharmacyPhone: string;
        pharmacyEmail: string;
        pharmacyCoordinates?: [number, number];
        price: number;
        stockQuantity: number;
        originalMatch: string;
        genericMatch: string;
        distance: number;
      }>
    >();

    const unavailableMedicines: string[] = [];

    // Find live products in the main database
    for (const rMed of resolvedMeds) {
      const matchKey = rMed.originalName;
      const lowerOriginal = rMed.originalName.toLowerCase().trim();
      const lowerGeneric = rMed.genericName.toLowerCase().trim();

      // Find all database medicines matching this item (by name, genericName, or RAG resolved names)
      const matchedMeds = resolvedActiveMeds
        .filter((rm) => {
          const dbName = (rm.medicine.name || "").toLowerCase().trim();
          const dbGeneric = (rm.medicine.genericName || "")
            .toLowerCase()
            .trim();

          return (
            dbName === lowerOriginal ||
            dbGeneric === lowerOriginal ||
            dbName === lowerGeneric ||
            dbGeneric === lowerGeneric ||
            rm.resolvedName === lowerGeneric ||
            rm.resolvedGeneric === lowerGeneric ||
            rm.resolvedName === lowerOriginal ||
            rm.resolvedGeneric === lowerOriginal
          );
        })
        .map((rm) => rm.medicine);

      if (matchedMeds.length === 0) {
        unavailableMedicines.push(matchKey);
        continue;
      }

      // Fetch corresponding sellers from main database User collection
      const sellerIds = matchedMeds.map((m) => m.sellerId);
      const sellers = await Pharmacy.find({
        _id: { $in: sellerIds },
        role: "seller",
        isBlocked: false,
      });

      const providers: any[] = [];

      for (const item of matchedMeds) {
        if (!item.sellerId) continue;
        const seller = sellers.find(
          (s) => s._id.toString() === item.sellerId.toString(),
        );
        if (!seller) continue;

        let distance = 0;
        if (
          seller.location &&
          seller.location.coordinates &&
          seller.location.coordinates.length === 2
        ) {
          distance = calculateDistance(
            resolvedPatientCoords[0],
            resolvedPatientCoords[1],
            seller.location.coordinates[1],
            seller.location.coordinates[0],
          );
        }

        const basePrice = item.pricing.sellingPrice;
        const gst = item.pricing.gst || 0;
        const finalPrice = basePrice + (basePrice * gst) / 100;

        providers.push({
          pharmacyId: seller._id.toString(),
          pharmacyName: seller.name,
          pharmacyPhone: seller.phone || "",
          pharmacyEmail: seller.email || "",
          pharmacyCoordinates: seller.location?.coordinates as
            | [number, number]
            | undefined,
          price: finalPrice,
          stockQuantity: item.stock,
          originalMatch: item.name,
          genericMatch: item.genericName || rMed.genericName,
          distance: parseFloat(distance.toFixed(2)),
        });
      }

      if (providers.length === 0) {
        unavailableMedicines.push(matchKey);
      } else {
        medicineToPharmaciesMap.set(matchKey, providers);
      }
    }

    // 3. Greedy Set Cover Algorithm with Geolocation Proximity tie-breaking
    const uncoveredMedicines = new Set<string>(
      resolvedMeds
        .map((rm) => rm.originalName)
        .filter((name) => !unavailableMedicines.includes(name)),
    );

    const selectedSplitsMap = new Map<string, any>();

    // Load Cart or Health Report for quantity fallback if needed
    let cart: any = null;
    let report: any = null;
    if (prescriptionId.startsWith("cart-")) {
      try {
        cart = await Cart.findOne({ userId: patientId as any }).populate(
          "items.medicineId",
        );
      } catch (err) {
        console.error("⚠️ Failed to load cart for quantity fallback:", err);
      }
    } else {
      try {
        report = await HealthReport.findById(prescriptionId);
        if (!report) {
          report = await HealthReport.findOne({ bookingId: prescriptionId });
        }
      } catch (err) {
        console.error(
          "⚠️ Failed to load health report for quantity fallback:",
          err,
        );
      }
    }

    while (uncoveredMedicines.size > 0) {
      let bestPharmacyId = "";
      let bestPharmacyName = "";
      let bestCoverage: string[] = [];
      let bestPharmacyDistance = Infinity;
      let bestPharmacyCost = Infinity;

      // Extract unique pharmacy IDs from active providers
      const allPharmacies = new Set<string>();
      uncoveredMedicines.forEach((med) => {
        const providers = medicineToPharmaciesMap.get(med) || [];
        providers.forEach((p) => allPharmacies.add(p.pharmacyId));
      });

      for (const pharmacyId of allPharmacies) {
        const coverage: string[] = [];
        let pharmacyName = "";
        let distance = Infinity;
        let totalCostForMatched = 0;

        for (const uncoveredMed of uncoveredMedicines) {
          const providers = medicineToPharmaciesMap.get(uncoveredMed) || [];
          const hasStock = providers.find((p) => p.pharmacyId === pharmacyId);
          if (hasStock) {
            coverage.push(uncoveredMed);
            pharmacyName = hasStock.pharmacyName;
            distance = hasStock.distance;
            totalCostForMatched += hasStock.price;
          }
        }

        // Prioritize local pharmacies (e.g., within 20km)
        const LOCAL_RADIUS_KM = 20;
        const isCurrentLocal = distance <= LOCAL_RADIUS_KM;
        const isBestLocal = bestPharmacyDistance <= LOCAL_RADIUS_KM;

        let isBetter = false;

        if (isCurrentLocal && !isBestLocal) {
          isBetter = true;
        } else if (!isCurrentLocal && isBestLocal) {
          isBetter = false;
        } else {
          // Both are local or both are remote. Prioritize coverage, then distance, then cost.
          const isBetterCoverage = coverage.length > bestCoverage.length;
          const isSameCoverageBetterDistance =
            coverage.length === bestCoverage.length &&
            distance < bestPharmacyDistance;
          const isSameCoverageSameDistanceBetterCost =
            coverage.length === bestCoverage.length &&
            distance === bestPharmacyDistance &&
            totalCostForMatched < bestPharmacyCost;

          isBetter =
            isBetterCoverage ||
            isSameCoverageBetterDistance ||
            isSameCoverageSameDistanceBetterCost;
        }

        if (isBetter) {
          bestCoverage = coverage;
          bestPharmacyId = pharmacyId;
          bestPharmacyName = pharmacyName;
          bestPharmacyDistance = distance;
          bestPharmacyCost = totalCostForMatched;
        }
      }

      if (bestCoverage.length === 0) {
        break; // Fail-safe to avoid infinite loop
      }

      const itemsList: any[] = [];
      let subtotal = 0;

      for (const medName of bestCoverage) {
        const providers = medicineToPharmaciesMap.get(medName) || [];
        const providerInfo = providers.find(
          (p) => p.pharmacyId === bestPharmacyId,
        )!;
        const resolvedMed = resolvedMeds.find(
          (rm) => rm.originalName === medName,
        );

        // Retrieve the quantity
        let qty = resolvedMed?.quantity || 1;
        if (qty === 1) {
          if (cart && cart.items) {
            const cartItem = cart.items.find(
              (item: any) =>
                item.medicineId &&
                ((item.medicineId.name || "").toLowerCase() === medName.toLowerCase() ||
                  (item.medicineId.name || "").toLowerCase() ===
                    providerInfo.originalMatch.toLowerCase()),
            );
            if (cartItem) {
              qty = cartItem.quantity;
            }
          } else if (report && report.medicines) {
            const reportItem = report.medicines.find(
              (m: any) =>
                m.name.toLowerCase() === medName.toLowerCase() ||
                m.name.toLowerCase() ===
                  providerInfo.originalMatch.toLowerCase(),
            );
            if (reportItem) {
              qty = reportItem.quantity;
            }
          }
        }

        itemsList.push({
          name: providerInfo.originalMatch,
          genericName: providerInfo.genericMatch,
          price: parseFloat(providerInfo.price.toFixed(2)),
          quantity: qty,
        });

        subtotal += providerInfo.price * qty;
        uncoveredMedicines.delete(medName);
      }

      // Get pharmacy contact info from any provider entry for this pharmacy
      const anyProviderForPharmacy =
        bestCoverage.length > 0
          ? (medicineToPharmaciesMap.get(bestCoverage[0] as string) || []).find(
              (p) => p.pharmacyId === bestPharmacyId,
            )
          : undefined;

      selectedSplitsMap.set(bestPharmacyId, {
        pharmacyName: bestPharmacyName,
        pharmacyPhone: anyProviderForPharmacy?.pharmacyPhone,
        pharmacyEmail: anyProviderForPharmacy?.pharmacyEmail,
        pharmacyCoordinates: anyProviderForPharmacy?.pharmacyCoordinates,
        medicines: itemsList,
        subtotal: parseFloat(subtotal.toFixed(2)),
        distance: bestPharmacyDistance,
      });
    }

    // 4. Build database entry split payload
    const splits: any[] = [];
    let totalAmount = 0;

    selectedSplitsMap.forEach((val, key) => {
      splits.push({
        pharmacyId: new Types.ObjectId(key),
        pharmacyName: val.pharmacyName,
        pharmacyPhone: val.pharmacyPhone,
        pharmacyEmail: val.pharmacyEmail,
        pharmacyCoordinates: val.pharmacyCoordinates,
        distance: val.distance,
        medicines: val.medicines,
        subtotal: val.subtotal,
      });
      totalAmount += val.subtotal;
    });

    const fulfillment = new Fulfillment({
      prescriptionId,
      patientId,
      originalMedicines: normalizedMedicines.map((m) => m.name),
      unavailableMedicines,
      splits,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      status: "pending",
    });

    return await fulfillment.save();
  }

  /**
   * Directly plans fulfillment using provided input inventories.
   */
  public static async planFulfillment(
    prescription: string[],
    pharmacies: any[],
  ): Promise<any> {
    if (
      !prescription ||
      !Array.isArray(prescription) ||
      prescription.length === 0
    ) {
      throw new Error("Prescription medicine list cannot be empty");
    }
    if (!pharmacies || !Array.isArray(pharmacies)) {
      throw new Error("Pharmacies list must be a valid array");
    }

    // Resolve prescription items
    const resolvedPrescription = prescription.map((med) => {
      return {
        original: med.trim(),
        canonical: med.trim(),
      };
    });

    // Resolve all pharmacy inventory items
    const resolvedPharmacies = pharmacies.map((pharmacy) => {
      if (!pharmacy.inventory || !Array.isArray(pharmacy.inventory)) {
        return { ...pharmacy, resolvedInventory: [] };
      }
      const resolvedInventory = pharmacy.inventory.map((inv: any) => {
        const canonicalName = inv.name || "";
        const canonicalGeneric = inv.genericName || canonicalName;
        return {
          ...inv,
          canonicalName,
          canonicalGeneric,
        };
      });
      return {
        ...pharmacy,
        resolvedInventory,
      };
    });

    const uncovered = new Set<string>(
      resolvedPrescription.map((m) => m.original),
    );
    const planMap = new Map<
      string,
      {
        pharmacy: string;
        address: string;
        medicines: string[];
        distance: string;
        cost: number;
      }
    >();

    const getPharmacyKey = (p: any) => `${p.name} - ${p.address}`;

    while (uncovered.size > 0) {
      let bestPharmacy: any = null;
      let bestCoverage: string[] = [];
      let bestDistance = Infinity;
      let bestCost = Infinity;

      for (const pharmacy of resolvedPharmacies) {
        const coverage: string[] = [];
        let totalCostForMatched = 0;

        for (const uncOriginal of uncovered) {
          const uncResolved = resolvedPrescription.find(
            (p) => p.original === uncOriginal,
          )!;
          const lowerOriginal = uncOriginal.toLowerCase().trim();
          const lowerCanonical = uncResolved.canonical.toLowerCase().trim();

          // Match by name, genericName, or resolved names
          const matchedItem = pharmacy.resolvedInventory?.find((inv: any) => {
            if (inv.stock <= 0) return false;

            const dbName = (inv.name || "").toLowerCase().trim();
            const dbGeneric = (inv.genericName || "").toLowerCase().trim();
            const dbCanonicalName = (inv.canonicalName || "")
              .toLowerCase()
              .trim();
            const dbCanonicalGeneric = (inv.canonicalGeneric || "")
              .toLowerCase()
              .trim();

            return (
              dbName === lowerOriginal ||
              dbGeneric === lowerOriginal ||
              dbName === lowerCanonical ||
              dbGeneric === lowerCanonical ||
              dbCanonicalName === lowerCanonical ||
              dbCanonicalGeneric === lowerCanonical ||
              dbCanonicalName === lowerOriginal ||
              dbCanonicalGeneric === lowerOriginal
            );
          });

          if (matchedItem) {
            coverage.push(uncOriginal);
            totalCostForMatched += matchedItem.price;
          }
        }

        if (coverage.length === 0) continue;

        let distNum = 0;
        if (typeof pharmacy.distance === "number") {
          distNum = pharmacy.distance;
        } else if (typeof pharmacy.distance === "string") {
          distNum = parseFloat(pharmacy.distance) || 0;
        }

        if (bestPharmacy === null) {
          bestPharmacy = pharmacy;
          bestCoverage = coverage;
          bestDistance = distNum;
          bestCost = totalCostForMatched;
        } else {
          // Prioritize local pharmacies (e.g., within 20km)
          const LOCAL_RADIUS_KM = 20;
          const isCurrentLocal = distNum <= LOCAL_RADIUS_KM;
          const isBestLocal = bestDistance <= LOCAL_RADIUS_KM;

          let isBetter = false;

          if (isCurrentLocal && !isBestLocal) {
            isBetter = true;
          } else if (!isCurrentLocal && isBestLocal) {
            isBetter = false;
          } else {
            // Both are local or both are remote
            const isBetterCoverage = coverage.length > bestCoverage.length;
            const isSameCoverageBetterDistance =
              coverage.length === bestCoverage.length && distNum < bestDistance;
            const isSameCoverageSameDistanceBetterCost =
              coverage.length === bestCoverage.length &&
              distNum === bestDistance &&
              totalCostForMatched < bestCost;

            isBetter =
              isBetterCoverage ||
              isSameCoverageBetterDistance ||
              isSameCoverageSameDistanceBetterCost;
          }

          if (isBetter) {
            bestPharmacy = pharmacy;
            bestCoverage = coverage;
            bestDistance = distNum;
            bestCost = totalCostForMatched;
          }
        }
      }

      if (!bestPharmacy || bestCoverage.length === 0) {
        break;
      }

      const key = getPharmacyKey(bestPharmacy);
      let existing = planMap.get(key);
      if (!existing) {
        const formattedDistance =
          typeof bestPharmacy.distance === "number"
            ? `${bestPharmacy.distance} km`
            : bestPharmacy.distance.toLowerCase().includes("km")
              ? bestPharmacy.distance
              : `${bestPharmacy.distance} km`;

        existing = {
          pharmacy: bestPharmacy.name,
          address: bestPharmacy.address,
          medicines: [],
          distance: formattedDistance,
          cost: 0,
        };
        planMap.set(key, existing);
      }

      for (const med of bestCoverage) {
        existing.medicines.push(med);

        const uncResolved = resolvedPrescription.find(
          (p) => p.original === med,
        )!;
        const lowerOriginal = med.toLowerCase().trim();
        const lowerCanonical = uncResolved.canonical.toLowerCase().trim();

        const matchedItem = bestPharmacy.resolvedInventory.find((inv: any) => {
          const dbName = (inv.name || "").toLowerCase().trim();
          const dbGeneric = (inv.genericName || "").toLowerCase().trim();
          const dbCanonicalName = (inv.canonicalName || "")
            .toLowerCase()
            .trim();
          const dbCanonicalGeneric = (inv.canonicalGeneric || "")
            .toLowerCase()
            .trim();

          return (
            dbName === lowerOriginal ||
            dbGeneric === lowerOriginal ||
            dbName === lowerCanonical ||
            dbGeneric === lowerCanonical ||
            dbCanonicalName === lowerCanonical ||
            dbCanonicalGeneric === lowerCanonical ||
            dbCanonicalName === lowerOriginal ||
            dbCanonicalGeneric === lowerOriginal
          );
        })!;

        existing.cost += matchedItem.price;
        uncovered.delete(med);
      }
    }

    const planList = Array.from(planMap.values()).map((p) => ({
      pharmacy: p.pharmacy,
      address: p.address,
      medicines: p.medicines,
      distance: p.distance,
      estimated_cost: `₹${p.cost}`,
    }));

    const unavailableMedicines = Array.from(uncovered);
    const totalMedicinesFulfilled =
      prescription.length - unavailableMedicines.length;

    return {
      plan: planList,
      summary: {
        total_shops: planList.length,
        total_medicines_fulfilled: totalMedicinesFulfilled,
        unavailable_medicines: unavailableMedicines,
      },
      checkout_flow: "multi-shop-order-ready",
    };
  }
}
