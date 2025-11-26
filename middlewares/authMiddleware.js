import jwt from "jsonwebtoken";
import User from "../models/UserModel.js";

const authMiddleware = async (req, res, next) => {
  try {
    // Support both Authorization header formats
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing or invalid format",
      });
    }

    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user (exclude sensitive fields)
    const user = await User.findById(decoded.userId).select("-password -refreshToken");

    if (!user) {
      return res.status(401).json({ // 401 instead of 404
        success: false,
        message: "User not found or token invalid",
      });
    }

    // Optional: Check if user is active/not banned
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Account has been disabled",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    // Detailed error handling
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired",
      });
    }
    
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    // Generic error
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

export default authMiddleware;