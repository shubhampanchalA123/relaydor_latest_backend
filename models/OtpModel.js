import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    email: { type: String },
    mobile: { type: String },
    otp: { type: String, required: true },
    purpose: { type: String, default: "email_verification" },

    // OTP expire time using MongoDB TTL Index
    expireAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, 
    },
  },
  { timestamps: false }
);

export default mongoose.model("OTP", otpSchema);
