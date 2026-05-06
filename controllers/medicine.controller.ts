import { Medicine } from "../models/medicine.model.js";
import { Response, Request } from "express";
import { SellerRequest } from "../models/sellerRequest.model.js";
import { calculateDistance } from "../utils/geocode.js";
import axios from "axios";

export const getAllMedicines = async (req: Request, res: Response) => {
  try {
    const { search, lat, lng } = req.query;
    console.log("GET_ALL_STABLE_HIT:", { search, lat, lng });

    const query: any = { isActive: { $ne: false } };
    if (search && search !== "undefined" && search !== "") {
      const searchRegex = { $regex: String(search).trim(), $options: "i" };
      query.$or = [{ name: searchRegex }, { brand: searchRegex }, { category: searchRegex }, { manufacturer: searchRegex }];
    }

    const medicines = await Medicine.find(query).sort({ createdAt: -1 }).limit(50).lean();
    
    // Process with shop info
    const results = await Promise.all(medicines.map(async (med: any) => {
      try {
        let shop = null;
        if (med.sellerId) {
          shop = await SellerRequest.findOne({ userId: med.sellerId }).lean();
        }

        let distance = null;
        if (lat && lng && shop?.location?.lat != null && shop?.location?.lng != null) {
          distance = calculateDistance(Number(lat), Number(lng), Number(shop.location.lat), Number(shop.location.lng));
        }

        return {
          ...med,
          shop: shop ? {
            name: shop.shopName,
            address: shop.address,
            location: shop.location,
            distance: (distance !== null && !isNaN(distance)) ? Number(distance.toFixed(2)) : null
          } : null
        };
      } catch (err) {
        return { ...med, shop: null };
      }
    }));

    if (lat && lng) {
      results.sort((a, b) => (a.shop?.distance ?? Infinity) - (b.shop?.distance ?? Infinity));
    }

    return res.status(200).json({ success: true, medicines: results });
  } catch (error: any) {
    console.error("CRITICAL_GET_ALL_ERROR:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

export const getMedicineById = async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.query;
    const medicine = await Medicine.findOne({ _id: req.params.id, isActive: true }).lean();
    if (!medicine) return res.status(404).json({ message: "Medicine not found" });

    let shop = null;
    if (medicine.sellerId) {
      shop = await SellerRequest.findOne({ userId: medicine.sellerId }).lean();
    }

    let distance = null;
    if (lat && lng && shop?.location?.lat != null && shop?.location?.lng != null) {
      distance = calculateDistance(Number(lat), Number(lng), Number(shop.location.lat), Number(shop.location.lng));
    }

    return res.status(200).json({ 
      success: true,
      medicine: {
        ...medicine,
        shop: shop ? {
          name: shop.shopName,
          address: shop.address,
          location: shop.location,
          phone: shop.phone,
          licenseNumber: shop.licenseNumber,
          distance: (distance !== null && !isNaN(distance)) ? Number(distance.toFixed(2)) : null
        } : null
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const createMedicine = async (req: any, res: any) => {
  try {
    const { name, brand, category, unitWeight, manufacturer, stock, pricing, description, barcode, existingImageUrls } = req.body;
    
    let parsedPricing = { mrp: 0, sellingPrice: 0, offer: "" };
    if (pricing) {
       parsedPricing = typeof pricing === 'string' ? JSON.parse(pricing) : pricing;
    }
    
    let images: string[] = [];
    
    // Add external image URLs if provided
    if (existingImageUrls) {
      const urls = typeof existingImageUrls === 'string' ? JSON.parse(existingImageUrls) : existingImageUrls;
      if (Array.isArray(urls)) {
        images = [...urls];
      }
    }

    // Add uploaded file images
    if (req.files && (req.files as any[]).length > 0) {
      const fileImages = (req.files as any[]).map((file) => file.filename);
      images = [...images, ...fileImages];
    }
    
    if (!medicine) {
      medicine = new Medicine({
        name,
        brand: brand || "Generic",
        category: category || "General",
        manufacturer: manufacturer || "Unknown",
        description,
        unitWeight,
        images,
        sellerId: req.user.id, // Original uploader
        barcode,
        stock: Number(stock) || 0,
        pricing: parsedPricing
      });
      await medicine.save();
    } else {
      // If medicine exists (barcode or name match), update the stock and pricing for this seller
      medicine.stock = Number(stock) || 0;
      medicine.pricing = parsedPricing;
      await medicine.save();
    }

    return res.status(201).json({ success: true, medicine });
  } catch (error: any) {
    console.error("Create Medicine Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getMedicines = async (req: any, res: any) => {
  try {
    const { search } = req.query;
    const query: any = { sellerId: req.user.id, isActive: { $ne: false } };
    
    if (search && search !== "undefined" && search !== "") {
      const searchRegex = { $regex: String(search).trim(), $options: "i" };
      query.$or = [{ name: searchRegex }, { brand: searchRegex }, { category: searchRegex }];
    }
    
    const medicines = await Medicine.find(query).sort({ createdAt: -1 });
    return res.json({ success: true, medicines });
  } catch (error: any) {
    console.error("Get Medicines Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMedicine = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { name, brand, category, unitWeight, manufacturer, stock, pricing, description, barcode, existingImages } = req.body;
    
    let parsedPricing;
    if (pricing) {
       parsedPricing = typeof pricing === 'string' ? JSON.parse(pricing) : pricing;
    }
    
    let updatedImages: string[] = [];
    
    // 1. Add existing images (if any)
    if (existingImages) {
      if (Array.isArray(existingImages)) {
        updatedImages = [...existingImages];
      } else {
        updatedImages = [existingImages];
      }
    }
    
    // 2. Add new uploaded files
    if (req.files && (req.files as any[]).length > 0) {
      const newFiles = (req.files as any[]).map((file) => file.filename);
      updatedImages = [...updatedImages, ...newFiles];
    }
    
    let updateData: any = { 
      name, 
      brand, 
      category, 
      unitWeight, 
      manufacturer, 
      stock: Number(stock), 
      description, 
      barcode,
      images: updatedImages 
    };
    if (parsedPricing) updateData.pricing = parsedPricing;
    
    const medicine = await Medicine.findOneAndUpdate(
      { _id: id, sellerId: req.user.id },
      updateData,
      { new: true }
    );
    
    if (!medicine) return res.status(404).json({ success: false, message: "Medicine not found" });
    return res.json({ success: true, medicine });
  } catch (error: any) {
    console.error("Update Medicine Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteMedicine = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const medicine = await Medicine.findOneAndUpdate(
      { _id: id, sellerId: req.user.id },
      { isActive: false },
      { new: true }
    );
    if (!medicine) return res.status(404).json({ success: false, message: "Medicine not found" });
    return res.json({ success: true, message: "Deleted successfully" });
  } catch (error: any) {
    console.error("Delete Medicine Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


export const getMedicineByBarcode = async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params;
    console.log(">>> ENHANCED_BARCODE_LOOKUP:", barcode);
    if (!barcode) return res.status(400).json({ success: false, message: "Barcode is required" });

    // 1. Check local database first
    const localMedicine = await Medicine.findOne({ barcode, isActive: { $ne: false } })
      .sort({ createdAt: -1 })
      .lean();

    if (localMedicine) {
      return res.status(200).json({ success: true, medicine: localMedicine, source: "local" });
    }

    // 2. Multi-API External Search
    const results: any = {
      name: "",
      brand: "",
      description: "",
      manufacturer: "",
      category: "",
      images: [] as string[]
    };

    // Parallel lookup for speed
    const [fdaRes, rxRes, upcRes] = await Promise.allSettled([
      axios.get(`https://api.fda.gov/drug/label.json?search=openfda.upc:"${barcode}"`),
      axios.get(`https://rxnav.nlm.nih.gov/REST/rxcui.json?idtype=UPC&id=${barcode}`),
      axios.get(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`)
    ]);

    // Process openFDA results
    if (fdaRes.status === 'fulfilled' && fdaRes.value.data.results?.[0]) {
      const drug = fdaRes.value.data.results[0];
      results.name = drug.openfda?.brand_name?.[0] || drug.generic_name?.[0] || results.name;
      results.brand = drug.openfda?.brand_name?.[0] || results.brand;
      results.manufacturer = drug.openfda?.manufacturer_name?.[0] || results.manufacturer;
      results.description = drug.description?.[0] || drug.indications_and_usage?.[0] || results.description;
    }

    // Process RxNorm results
    if (rxRes.status === 'fulfilled' && rxRes.value.data.idGroup?.rxnormId) {
      const rxcui = rxRes.value.data.idGroup.rxnormId[0];
      try {
        const detailRes = await axios.get(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/allProperties.json?propCategories=ATTRIBUTES`);
        const props = detailRes.data.propConceptGroup?.propConcept || [];
        const nameProp = props.find((p: any) => p.propName === "Name");
        if (nameProp && !results.name) results.name = nameProp.propValue;
      } catch (e) { console.error("RxNorm properties lookup failed"); }
    }

    // Process UPCitemdb results
    if (upcRes.status === 'fulfilled' && upcRes.value.data.items?.[0]) {
      const item = upcRes.value.data.items[0];
      results.name = results.name || item.title;
      results.brand = results.brand || item.brand;
      results.description = results.description || item.description;
      results.category = results.category || item.category;
      if (item.images && item.images.length > 0) {
        results.images = [...new Set([...results.images, ...item.images])];
      }
    }

    if (results.name) {
      return res.status(200).json({ 
        success: true, 
        medicine: results, 
        source: "external_aggregator" 
      });
    }

    return res.status(404).json({ success: false, message: "Product not found in any database" });

  } catch (error: any) {
    console.error("Barcode Lookup Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
