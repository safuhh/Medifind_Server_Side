import Joi from "joi";

export const sellerApplySchema = Joi.object({
  shopName: Joi.string().min(3).max(50).required().messages({
    "string.empty": "Shop name is required",
    "string.min": "Shop name must be at least 3 characters",
    "string.max": "Shop name cannot exceed 50 characters",
  }),
  licenseNumber: Joi.string().alphanum().min(5).max(20).required().messages({
    "string.empty": "License number is required",
    "string.alphanum": "License number must only contain alphanumeric characters",
    "string.min": "License number must be at least 5 characters",
    "string.max": "License number cannot exceed 20 characters",
  }),
  address: Joi.string().min(10).required().messages({
    "string.empty": "Address is required",
    "string.min": "Address must be at least 10 characters",
  }),
  phone: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required()
    .messages({
      "string.empty": "Phone number is required",
      "string.pattern.base": "Phone number must be a 10-digit number",
    }),
});
