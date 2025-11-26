import crypto from "crypto";

export const generateOtp = () => {
  const otp = crypto.randomInt(100000, 999999).toString();
  const expire = Date.now() + 10 * 60 * 1000; // 10 mins expiry
  return { otp, expire };
};
