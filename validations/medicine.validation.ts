import Joi from "joi";

export const createMedicineSchema = Joi.object({
  name: Joi.string().required().messages({
    "string.empty": "Medicine name is required",
  }),
  brand: Joi.string().allow("").optional(),
  category: Joi.string()
    .valid(
      "pain relief",
      "antibiotics",
      "diabetes",
      "cardiology",
      "skin care",
      "vitamins",
      "baby care",
      "respiratory",
      "other"
    )
    .required()
    .messages({
      "any.only": "Invalid category selected",
      "string.empty": "Category is required",
    }),
  unitWeight: Joi.string().allow("").optional(),
  manufacturer: Joi.string().allow("").optional(),
  stock: Joi.any().optional(),
  pricing: Joi.string().allow("").optional(),
  description: Joi.string().allow("").optional(),
  barcode: Joi.string().allow("").optional(),
  existingImageUrls: Joi.string().allow("").optional(),
  visibility: Joi.string().valid("public", "restricted").optional(),
});
