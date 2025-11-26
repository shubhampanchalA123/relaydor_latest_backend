import express from "express";
import {
  addPatient,
  getMyPatients,
  getPatientById,
  updatePatient,
  deletePatient
} from "../controllers/PatientController.js";
import protect from "../middlewares/roleAuthMiddleware.js"; 

const router = express.Router();

// ------------------------------
// All routes protected for doctors only
// ------------------------------

// Add new patient
router.post("/", protect(["doctor"]), addPatient);

// Get all patients of logged-in doctor
router.get("/", protect(["doctor"]), getMyPatients);

// Get single patient by ID
router.get("/:id", protect(["doctor"]), getPatientById);

// Update patient
router.put("/:id", protect(["doctor"]), updatePatient);

// Delete patient
router.delete("/:id", protect(["doctor"]), deletePatient);

export default router;
