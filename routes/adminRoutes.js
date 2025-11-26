import express from "express";
import { verifyDoctorDocuments } from "../controllers/adminController.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import protect from "../middlewares/roleAuthMiddleware.js";

const router = express.Router();

// Only admin can verify doctor documents
router.put(
  "/verify-doctor-documents",
  authMiddleware,
  protect(["admin"]),
  verifyDoctorDocuments
);

export default router;
