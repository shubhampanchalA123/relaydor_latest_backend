import mongoose from "mongoose";

const patientReferralSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  fromDoctor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  toDoctor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reason: { type: String },          
  status: { type: String, default: "pending" }, 
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model("PatientReferral", patientReferralSchema);
