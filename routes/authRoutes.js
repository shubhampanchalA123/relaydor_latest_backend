import express from "express";
import { registerUser, verifyEmailOTP, login, getProfile, updateProfile, verifyMobileOTP, resendEmailOTP, resendMobileOTP, forgotPassword, resetPassword,uploadProfileImage} from "../controllers/authController.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import upload from "../middlewares/multerMiddleware.js";
const router = express.Router();

// REGISTER ROUTE
router.post("/register", registerUser);
router.post("/verify-email", verifyEmailOTP); // Placeholder for email verification route
router.post("/verify-mobile", verifyMobileOTP); // Placeholder for mobile verification route
router.post("/login", login); // Login route for both admin and user
router.post("/resend-email-otp", resendEmailOTP);
router.post("/resend-mobile-otp", resendMobileOTP);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/profile", authMiddleware, getProfile); // Profile route with auth middleware
router.put("/profile-update", authMiddleware, updateProfile); // Update profile route with auth middleware

// Upload profile image
router.patch(
  "/upload-profile-image",
  authMiddleware,    // user login check
  upload.single("profileImage"), // multer single file
  uploadProfileImage // controller
);


export default router;

