import Joi from "joi";

// 🚀 APPLY VALIDATION
export const applyDeliveryBoySchema = Joi.object({
  name: Joi.string().min(3).max(50).required(),

  phone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required(),

  vehicleType: Joi.string()
    .valid("bike", "scooter", "cycle")
    .required(),

  vehicleNumber: Joi.string().min(5).max(20).required(),

  address: Joi.string().min(5).max(100).required(),

  aadhaarNumber: Joi.string()
    .pattern(/^\d{12}$/)
    .required(),

  aadhaarImage: Joi.string().uri().required(),

  lat: Joi.number().required(),
  lng: Joi.number().required(),
});


// 🚀 UPDATE VALIDATION
export const updateDeliveryBoySchema = Joi.object({
  name: Joi.string().min(3).max(50),

  phone: Joi.string()
    .pattern(/^[6-9]\d{9}$/),

  vehicleType: Joi.string()
    .valid("bike", "scooter", "cycle"),

  vehicleNumber: Joi.string().min(5).max(20),
});