import mongoose, { Schema, model } from "mongoose";

const doctorAvailabilitySchema = new Schema({
  doctor_id: {
    type: Schema.Types.ObjectId,
    ref: "Doctor",
  },
  weeklyavailability: {
    monday: {
      type: Boolean,
      default: false,
    },
    tuesday: {
      type: Boolean,
      default: false,
    },
    wednesday: {
      type: Boolean,
      default: false,
    },
    thursday: {
      type: Boolean,
      default: false,
    },
    friday: {
      type: Boolean,
      default: false,
    },
    saturday: {
      type: Boolean,
      default: false,
    },
    sunday: {
      type: Boolean,
      default: false,
    },
  },
  dailyavailability: {
    morning: {
      from: {
        type: String,
        default: "",
      },
      to: {
        type: String,
        default: "",
      },
    },
    evening: {
      from: {
        type: String,
        default: "",
      },
      to: {
        type: String,
        default: "",
      },
    },
  },
  slotDuration: {
    type: Number,
    default: 15,
  },
});
export default mongoose.model("DoctorAvailability", doctorAvailabilitySchema);
