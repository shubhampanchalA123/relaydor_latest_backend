import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",       // doctor ka ID
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    

    age: {
      type: Number,
      required: true,
    },

    gender: {
      type: String,
      enum: ["male", "female", "other"],
      required: true,
    },

    mobile: {
      type: String,
      required: true,
    },

    address: {
      type: String,
      default: "",
    },

    problem: {
      type: String,
      required: true, // main problem / symptom
    },

    diagnosis: {
      type: String,
      default: "", // doctor ki diagnosis
    },

    prescription: {
      type: String,
      default: "", // medicines
    },

    visitDate: {
      type: Date,
      default: Date.now,
    },

    // history support future use ke liye
    pastVisits: [
      {
        date: { type: Date, default: Date.now },
        diagnosis: String,
        prescription: String,
        notes: String,
      },
    ],
  },
  { timestamps: true }
);

const Patient = mongoose.model("Patient", patientSchema);
export default Patient;