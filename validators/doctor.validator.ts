import Joi from "joi";

export const doctorApplicationSchema = Joi.object({
  fullName: Joi.string().required().min(3).max(50),
  phone: Joi.string().required().pattern(/^[0-9]{10,12}$/),
  email: Joi.string().email().required(),
  address: Joi.string().required().min(10),
  
  location: Joi.object({
    type: Joi.string().valid("Point").default("Point"),
    coordinates: Joi.array().items(Joi.number()).length(2).required(),
  }).required(),

  qualification: Joi.object({
    degree: Joi.string().required(),
    collegeName: Joi.string().required(),
    university: Joi.string().required(),
    certificateUrl: Joi.string().uri().required(),
  }).required(),

  registrationNumber: Joi.string().required(),
  medicalCouncil: Joi.string().required(),
  experienceYears: Joi.number().required().min(0),
  specialization: Joi.string().required().valid(
    "Cardiologist",
    "Dermatologist",
    "Neurologist",
    "Orthopedic Surgeon",
    "Pediatrician",
    "Gynecologist",
    "Psychiatrist",
    "Oncologist",
    "Endocrinologist",
    "Gastroenterologist",
    "General Physician"
  ),

  profileImage: Joi.string().uri().required(),
  selfieWithId: Joi.string().uri().optional(),
  consultationFee: Joi.number().min(0).optional(),
});
