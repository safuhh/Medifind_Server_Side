import axios from "axios";

export const getAddressFromCoords = async (lat: number, lng: number) => {
  try {
    console.log(`>>> GEOCODING START: lat=${lat}, lng=${lng}`);
    const res = await axios.get("https://nominatim.openstreetmap.org/reverse", {
      params: {
        lat,
        lon: lng,
        format: "json",
      },
      headers: {
        "User-Agent": "medifind-app/1.0",
      },
      timeout: 5000,
    });

    const data = res.data;
    console.log(">>> NOMINATIM RESPONSE:", !!data);

    if (!data || !data.address) {
      console.log(">>> NOMINATIM EMPTY ADDRESS:", data);
      return { shortName: "Unknown location", fullAddress: "Address not found" };
    }

    const shortName =
      data.name ||
      data.address?.amenity ||
      data.address?.shop ||
      data.address?.tourism ||
      data.address?.building ||
      data.address?.road ||
      data.address?.village ||
      data.address?.town ||
      data.address?.city ||
      "Unknown place";

    return {
      shortName,
      fullAddress: data.display_name || "",
    };
  } catch (err: any) {
    console.error(">>> GEOCODE CRITICAL ERROR:", err.message);
    if (err.response) {
      console.error(">>> ERROR DATA:", err.response.data);
    }
    return {
      shortName: "Location lookup failed",
      fullAddress: "",
    };
  }
};

export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};
