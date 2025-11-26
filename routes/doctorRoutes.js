import express from "express";
import { updateAvailability, getDoctorList } from "../controllers/doctorController.js";
import { uploadDocuments } from "../controllers/authController.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import protect from "../middlewares/roleAuthMiddleware.js";
import upload from "../middlewares/multerMiddleware.js";

const router = express.Router();

router.put("/availabilityUpdate", authMiddleware, updateAvailability);
router.get("/list", authMiddleware, getDoctorList);

// Upload documents route
router.patch(
  "/upload-documents",
  protect(["doctor"]),
  upload.fields([
    { name: "governmentId", maxCount: 1 },
    { name: "medicalCertificate", maxCount: 1 },
    { name: "degreeCertificate", maxCount: 1 },
  ]),
  uploadDocuments
);

export default router;
