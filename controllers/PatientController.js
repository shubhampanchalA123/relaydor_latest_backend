import Patient from "../models/PatientSchema.js";
import User from "../models/UserModel.js";
import PatientReferral from "../models/PatientReferralSchema.js";
// ---------------------------------
// ADD NEW PATIENT
// ---------------------------------
const addPatient = async (req, res, next) => {
  try {
    const { name, age, gender, mobile, address, problem, diagnosis, prescription } = req.body;

    // Check required fields
    if (!name || !age || !gender || !mobile || !problem) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields: name, age, gender, mobile, problem,prescription",
      });
    }

    const newPatient = await Patient.create({
      doctorId: req.user._id, // logged-in doctor
      name,
      age,
      gender,
      mobile,
      address,
      problem,
      diagnosis,
      prescription,
    });

    res.status(201).json({
      success: true,
      message: "Patient added successfully",
      data: newPatient,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------
// GET ALL PATIENTS OF LOGGED-IN DOCTOR
// ---------------------------------
const getMyPatients = async (req, res, next) => {
  try {
    const patients = await Patient.find({ doctorId: req.user._id }).sort({ visitDate: -1 });

    res.status(200).json({
      success: true,
      data: patients,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------
// GET SINGLE PATIENT BY ID
// ---------------------------------
const getPatientById = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    // Check doctor access
    if (patient.doctorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    res.status(200).json({ success: true, data: patient });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------
// UPDATE PATIENT
// ---------------------------------
const updatePatient = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    if (patient.doctorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const updates = req.body;
    Object.keys(updates).forEach(key => {
      patient[key] = updates[key];
    });

    await patient.save();

    res.status(200).json({ success: true, message: "Patient updated successfully", data: patient });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------
// DELETE PATIENT
// ---------------------------------
const deletePatient = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    if (patient.doctorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    await patient.remove();

    res.status(200).json({ success: true, message: "Patient deleted successfully" });
  } catch (error) {
    next(error);
  }
};





// refrelected functions


// 1. Create referral
const referPatient = async (req, res) => {
  try {
    const { patientId, toDoctorId, reason } = req.body;

    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ success: false, message: "Patient not found" });

    const referral = await PatientReferral.create({
      patient: patientId,
      fromDoctor: req.user._id,
      toDoctor: toDoctorId,
      reason,
    });

    res.status(201).json({ success: true, message: "Patient referred successfully", data: referral });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Get referrals sent by doctor
const getSentReferrals = async (req, res) => {
  try {
    const referrals = await PatientReferral.find({ fromDoctor: req.user._id })
      .populate("patient")
      .populate("toDoctor", "name speciality");
    res.status(200).json({ success: true, data: referrals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Get referrals received by doctor
const getReceivedReferrals = async (req, res) => {
  try {
    const referrals = await PatientReferral.find({ toDoctor: req.user._id })
      .populate("patient")
      .populate("fromDoctor", "name speciality");
    res.status(200).json({ success: true, data: referrals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Update referral status
const updateReferralStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const referral = await PatientReferral.findById(id);
    if (!referral) return res.status(404).json({ success: false, message: "Referral not found" });

    // Only the receiving doctor can update status
    if (referral.toDoctor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    referral.status = status;
    referral.updatedAt = Date.now();
    await referral.save();

    res.status(200).json({ success: true, message: "Referral status updated", data: referral });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


export { addPatient, getMyPatients, getPatientById, updatePatient, deletePatient ,referPatient, getSentReferrals, getReceivedReferrals, updateReferralStatus};
