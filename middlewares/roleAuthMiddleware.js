import jwt from "jsonwebtoken";
import User from "../models/UserModel.js";

// roles: array of allowed roles, e.g., ["doctor", "admin"]
const protect = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
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

      const user = await User.findById(decoded.userId).select("-password -refreshToken");
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found or token invalid",
        });
      }

      if (user.isBlocked) {
        return res.status(403).json({
          success: false,
          message: "Account has been disabled",
        });
      }

      req.user = user;

      // Role-based check
      if (allowedRoles.length > 0 && !allowedRoles.includes(user.userRole)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required role(s): ${allowedRoles.join(", ")}`,
        });
      }

      next();
    } catch (error) {
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
      console.error("Auth middleware error:", error);
      return res.status(500).json({
        success: false,
        message: "Authentication failed",
      });
    }
  };
};

export default protect;
