import Joi from "joi";

export const deliveryDetailsSchema = Joi.object({
  name: Joi.string().required().messages({
    "string.empty": "Name is required",
  }),
  address: Joi.string().required().messages({
    "string.empty": "Address is required",
  }),
  landmark: Joi.string().allow("").optional(),
  city: Joi.string().required().messages({
    "string.empty": "City is required",
  }),
  state: Joi.string().required().messages({
    "string.empty": "State is required",
  }),
  zip: Joi.string().required().messages({
    "string.empty": "Zip code is required",
  }),
  country: Joi.string().required().messages({
    "string.empty": "Country is required",
  }),
  phone: Joi.string()
    .pattern(/^\+?\d{10,15}$/)
    .required()
    .messages({
      "string.empty": "Phone number is required",
      "string.pattern.base": "Phone number must be between 10 and 15 digits",
    }),
  email: Joi.string().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Invalid email format",
  }),
});
