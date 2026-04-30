import axios from "axios";

export const getAddressFromCoords = async (lat: number, lng: number) => {
  try {
    const res = await axios.get(
      "https://nominatim.openstreetmap.org/reverse",
      {
        params: {
          lat,
          lon: lng,
          format: "json",
        },
        headers: {
          "User-Agent": "medifind-app",
        },
      }
    );

    const data = res.data;

    console.log("GEOCODE RESPONSE:", data);

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
  } catch (err) {
    console.log("GEOCODE ERROR:", err);
    return {
      shortName: "Location not found",
      fullAddress: "",
    };
  }
};