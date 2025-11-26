import User from "../models/UserModel.js";

// Update doctor's availability status and broadcast via socket.io
export const updateAvailability = async (req, res, next) => {
  try {
    const { availabilityStatus } = req.body;
    const userId = req.user._id; // Assuming authMiddleware sets req.user

    if (!availabilityStatus) {
      return res.status(400).json({ success: false, message: "Availability status is required" });
    }

    const updatedDoctor = await User.findOneAndUpdate(
      { _id: userId, userRole: "doctor" },
      { availabilityStatus },
      { new: true }
    ).select("-password");

    if (!updatedDoctor) {
      return res.status(404).json({ success: false, message: "Doctor not found or unauthorized" });
    }

    // Emit availability update event via socket.io
    req.io.emit("availabilityUpdated", {
      doctorId: updatedDoctor._id,
      availabilityStatus: updatedDoctor.availabilityStatus,
    });

    res.status(200).json({ success: true, message: "Availability updated", doctor: updatedDoctor });
  } catch (error) {
    next(error);
  }
};

// Get list of doctors with availability status
export const getDoctorList = async (req, res, next) => {
  try {
    const doctors = await User.find({ userRole: "doctor" }).select("name email availabilityStatus");
    res.status(200).json({ success: true, doctors });
  } catch (error) {
    next(error);
  }
};
