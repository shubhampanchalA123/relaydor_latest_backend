import User from "../models/UserModel.js";
import { generateOtp } from "../utils/otpGenerator.js";
import sendEmail from "../utils/sendEmail.js";
import admin, { verifyFirebaseToken } from "../config/firebase.js";
import path from "path";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import OTP from "../models/otpModel.js";


const registerUser = async (req, res) => {
  try {
    const {
      name,
      email,
      mobile,
      dateOfBirth,
      password,
      userRole,
    } = req.body;

    if (!name || !email || !mobile || !dateOfBirth || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // 1️⃣ Check existing user
    const existingUser = await User.findOne({
      $or: [{ email }, { mobile }]
    });


    if (existingUser) {

      // A. User already verified
      if (existingUser.verified === true) {
        return res.status(400).json({
          success: false,
          message: "User already exists. Please login.",
        });
      }

      // B. Exists but NOT verified → resend Email OTP
      const { otp: emailOTP, expire: emailExpire } = generateOtp();

      // Save Email OTP
      await OTP.findOneAndUpdate(
        { email, purpose: "email_verification" },
        { otp: emailOTP, expireAt: emailExpire },
        { upsert: true }
      );

      // Send Email
      await sendEmail({
        to: email,
        subject: "Email Verification OTP",
        message: `Your OTP for email verification is: ${emailOTP}`,
      });

      return res.status(200).json({
        success: true,
        message: "Already registered but not verified. Email OTP sent. Mobile verification via Firebase.",
      });
    }

    // 2️⃣ New user registration
    const hashedPassword = await bcrypt.hash(password, 10);

    const { otp: emailOTP, expire: emailExpire } = generateOtp();

    // Save Email OTP
    await OTP.findOneAndUpdate(
      { email, purpose: "email_verification" },
      { otp: emailOTP, expireAt: emailExpire },
      { upsert: true }
    );

    // Create New User (NO email lowercase, NO role default)
    await User.create({
      name,
      email,
      mobile,
      dateOfBirth,
      password: hashedPassword,
      userRole,
      verified: false,
    });

    // Send Email OTP
    await sendEmail({
      to: email,
      subject: "Email Verification OTP",
      message: `Your OTP for email verification is: ${emailOTP}`,
    });

    return res.status(201).json({
      success: true,
      message: "User registered. Email OTP sent. Mobile verification via Firebase.",
    });

  } catch (err) {
    console.log("REGISTER ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};



// admin and user login controller
const login = async (req, res, next) => {
  try {
    const { email, password, userRole } = req.body;

    console.log("Login attempt:", email, userRole, password);
    if (!email || !password || !userRole) {
      return res.status(400).json({
        success: false,
        message: "Email, password, and userRole are required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "user is not exist with this email",
      });
    }

    console.log("Logging in user:", userRole);

    // 🛑 ROLE CHECK
    if (user.userRole !== userRole) {
      return res.status(403).json({
        success: false,
        message: `This account is not registered as ${userRole}`,
      });
    }

    // 🛑 If user is normal user or doctor → must verify both email + mobile
    if (userRole === "user" || userRole === "doctor") {
      if (!user.emailVerified || !user.mobileVerified) {
        return res.status(400).json({
          success: false,
          message: "Please verify your email and mobile before logging in.",
        });
      }
    }

    // 🛑 Admin login → No OTP needed
    // (admin ko OTP mat lagao varna admin login me problem ayegi)

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // JWT generate
    const token = jwt.sign(
      { userId: user._id, role: user.userRole },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      success: true,
      message: `${userRole} login successful`,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userRole: user.userRole,
        verified: user.verified,
        documentVerification: user.documentVerification
      },
    });

  } catch (error) {
    next(error);
  }
};


const verifyEmailOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
        missingFields: !email ? ["email"] : !otp ? ["otp"] : [],
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.emailVerified) {
      return res.status(400).json({ success: false, message: "Email already verified" });
    }

    const otpRecord = await OTP.findOne({ email: email.toLowerCase(), otp, purpose: "email_verification" });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    // expiry check
    if (Date.now() > otpRecord.expireAt.getTime()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: "OTP expired" });
    }

    // OTP correct → update user
    user.emailVerified = true;
    if (user.mobileVerified) user.verified = true;
    await user.save();

    // delete OTP
    await OTP.deleteOne({ _id: otpRecord._id });

    return res.status(200).json({ success: true, message: "Email verified successfully" });
  } catch (error) {
    next(error);
  }
};


const verifyMobileOTP = async (req, res, next) => {
   try {
     const { idToken } = req.body;

     if (!idToken) {
       return res.status(400).json({
         success: false,
         message: "Firebase ID token is required",
       });
     }

     // Verify Firebase ID token
     const decodedToken = await verifyFirebaseToken(idToken);

     const phoneNumber = decodedToken.phone_number;

     if (!phoneNumber) {
       return res.status(400).json({ success: false, message: "Phone number not found in token" });
     }

     const user = await User.findOne({ mobile: phoneNumber });
     if (!user) {
       return res.status(404).json({ success: false, message: "User not found" });
     }

     if (user.mobileVerified) {
       return res.status(400).json({ success: false, message: "Mobile already verified" });
     }

     // Update user
     user.mobileVerified = true;
     if (user.emailVerified) user.verified = true;
     await user.save();

     return res.status(200).json({ success: true, message: "Mobile verified successfully via Firebase" });
   } catch (error) {
     console.error("Firebase token verification error:", error);
     return res.status(400).json({ success: false, message: "Invalid Firebase token" });
   }
 };


const getProfile = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "User not authenticated"
    });
  }

  res.status(200).json({
    success: true,
    user: req.user
  });
};

const updateProfile = async (req, res) => {
  try {
    const { name, dateOfBirth, clinicAddress, hospitalAddress, workSchedule } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!name && !dateOfBirth && !clinicAddress && !hospitalAddress && !workSchedule) {
      return res.status(400).json({
        success: false,
        message: "At least one field must be provided for update"
      });
    }

    // Prepare update object
    const updateData = {};
    if (name) updateData.name = name;
    if (dateOfBirth) updateData.dateOfBirth = new Date(dateOfBirth);

    // Only allow doctor to update clinicAddress, hospitalAddress, and workSchedule
    if (req.user.userRole === "doctor") {
      if (clinicAddress) updateData.clinicAddress = clinicAddress;
      if (hospitalAddress) updateData.hospitalAddress = hospitalAddress;
      if (workSchedule) {
        updateData.workSchedule = {};
        if (workSchedule.opdTiming) updateData.workSchedule.opdTiming = workSchedule.opdTiming;
        if (workSchedule.opdDays) updateData.workSchedule.opdDays = workSchedule.opdDays;
        if (workSchedule.surgeryTiming) updateData.workSchedule.surgeryTiming = workSchedule.surgeryTiming;
        if (workSchedule.surgeryDays) updateData.workSchedule.surgeryDays = workSchedule.surgeryDays;
      }
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true }).select("-password");

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};


const resendEmailOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email already verified",
      });
    }

    const { otp, expire } = generateOtp();

    // Update or create OTP record for email verification
    await OTP.findOneAndUpdate(
      { email: email.toLowerCase(), purpose: "email_verification" },
      { otp, expireAt: expire },
      { upsert: true, new: true }
    );

    // Send OTP email
    await sendEmail({
      to: email,
      subject: "Resend Email Verification OTP",
      message: `Your new OTP for email verification is: ${otp}`,
    });

    return res.status(200).json({
      success: true,
      message: "OTP sent to email successfully",
    });
  } catch (error) {
    next(error);
  }
};

const resendMobileOTP = async (req, res, next) => {
  try {
    const { mobile } = req.body;
    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: "mobile number is required",
      });
    }

    const user = await User.findOne({ mobile });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.mobileVerified) {
      return res.status(400).json({
        success: false,
        message: "Mobile number already verified",
      });
    }

    const { otp, expire } = generateOtp();

    // Update or create OTP record for mobile verification
    await OTP.findOneAndUpdate(
      { mobile, purpose: "mobile_verification" },
      { otp, expireAt: expire },
      { upsert: true, new: true }
    );

    // Send OTP SMS
    await sendSMS({
      to: mobile,
      message: `Your new OTP for mobile verification is: ${otp}`,
    });

    return res.status(200).json({
      success: true,
      message: "OTP sent to mobile successfully",
    });
  } catch (error) {
    next(error);
  }
};


const forgotPassword = async (req, res, next) => {
   try {
     const { email } = req.body;

     if (!email) {
       return res.status(400).json({
         success: false,
         message: "Email is required",
       });
     }

     const user = await User.findOne({ email: email.toLowerCase() });
     if (!user) {
       return res.status(404).json({ success: false, message: "User not found" });
     }
     if (!user.verified) {
       return res.status(403).json({ success: false, message: "User account is not verified" });
     }

     // Generate OTP
     const { otp, expire } = generateOtp();

     // Update or create OTP record
     await OTP.findOneAndUpdate(
       { email: email.toLowerCase(), purpose: "forgot_password" },
       { otp, expireAt: expire },
       { upsert: true, new: true }
     );

     await sendEmail({
       to: email,
       subject: "Forgot Password OTP",
       message: `Your OTP for password reset is: ${otp}`,
     });

     return res.status(200).json({
       success: true,
       message: "OTP sent to email successfully",
     });

   } catch (error) {
     next(error);
   }
 };

const resetPassword = async (req, res, next) => {
  try {
    const { email, mobile, otp, newPassword } = req.body;

    if (!otp || !newPassword || (!email && !mobile)) {
      return res.status(400).json({
        success: false,
        message: "OTP, new password, and email or mobile are required",
      });
    }

    let otpRecord;
    let user;

    if (email) {
      user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      otpRecord = await OTP.findOne({ email: email.toLowerCase(), otp, purpose: "forgot_password" });
    } else if (mobile) {
      user = await User.findOne({ mobile });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      otpRecord = await OTP.findOne({ mobile, otp, purpose: "forgot_password" });
    }

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (Date.now() > otpRecord.expireAt.getTime()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: "OTP expired" });
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    await user.save();

    await OTP.deleteOne({ _id: otpRecord._id });

    return res.status(200).json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    next(error);
  }
};


// uplpad profie image controller

const uploadProfileImage = async (req, res) => {
  try {
    const userId = req.user._id;


    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "profileImage is required.",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profileImage: path.relative('public', req.file.path) },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Profile image uploaded successfully.",
      profileImage: updatedUser.profileImage,
    });

  } catch (error) {
    console.log("PROFILE IMAGE UPLOAD ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};





// doctor upload their documents for verification

// ======================================================
// 📌 DOCTOR DOCUMENT UPLOAD
// ======================================================
const uploadDocuments = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 1️⃣ Check verification status
    if (user.documentVerification === "pending") {
      return res.status(400).json({
        success: false,
        message: "Your previous documents are still pending review. Please wait for admin approval."
      });
    }

    if (user.documentVerification === "approved") {
      return res.status(400).json({
        success: false,
        message: "Your documents are already approved. No need to upload again."
      });
    }

    // 2️⃣ Ensure all files are provided
    if (!req.files) {
      return res.status(400).json({
        success: false,
        message: "Request must be multipart/form-data",
      });
    }
    const { governmentId, medicalCertificate, degreeCertificate } = req.files;
    if (!governmentId || !medicalCertificate || !degreeCertificate) {
      return res.status(400).json({
        success: false,
        message: "All 3 documents are required: governmentId, medicalCertificate, degreeCertificate",
      });
    }

    // 3️⃣ Update documents + reset verification status if rejected
    user.documents = {
      governmentId: path.relative('public', governmentId[0].path),
      medicalCertificate: path.relative('public', medicalCertificate[0].path),
      degreeCertificate: path.relative('public', degreeCertificate[0].path),
    };
    user.documentVerification = "pending"; // Reset status
    user.documentRejectReason = ""; // Clear previous reject reason
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Documents uploaded successfully. Waiting for admin approval.",
      user,
    });

  } catch (error) {
    console.log("DOCUMENT UPLOAD ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};



export { registerUser, login, verifyEmailOTP, verifyMobileOTP, getProfile, updateProfile, resendEmailOTP, resendMobileOTP, forgotPassword, resetPassword,uploadDocuments,uploadProfileImage };
