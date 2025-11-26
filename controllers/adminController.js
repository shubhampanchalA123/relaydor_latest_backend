import User from "../models/UserModel.js";
import sendEmail from "../utils/sendEmail.js";

/**
 * Controller to verify doctor documents by admin.
 * Request body should have:
 * - doctorId: ID of the doctor user
 * - verificationStatus: "approved" or "rejected"
 * - rejectReason: optional, required if rejected
 */
export const verifyDoctorDocuments = async (req, res) => {
    try {
        const { doctorId, verificationStatus, rejectReason } = req.body;

        // Validate required fields
        if (!doctorId || !verificationStatus) {
            return res.status(400).json({ message: "doctorId and verificationStatus are required." });
        }

        if (!["approved", "rejected"].includes(verificationStatus)) {
            return res.status(400).json({ message: "verificationStatus must be either 'approved' or 'rejected'." });
        }

        // Find the doctor user by ID
        const doctor = await User.findById(doctorId);
        if (!doctor) {
            return res.status(404).json({ message: "Doctor user not found." });
        }

        // Check if the user is actually a doctor
        if (doctor.userRole !== "doctor") {
            return res.status(400).json({ message: "User is not a doctor." });
        }

        // Update document verification status
        doctor.documentVerification = verificationStatus;

        // Email content
        let emailSubject = "";
        let emailMessage = "";

        if (verificationStatus === "rejected") {
            if (!rejectReason) {
                return res.status(400).json({ message: "rejectReason is required when rejecting documents." });
            }
            doctor.documentRejectReason = rejectReason;

            emailSubject = "Document Verification - Action Required";
            emailMessage = `
Dear Dr. ${doctor.name},

We regret to inform you that your submitted documents have not been approved due to the following reason:

${rejectReason}

Kindly review the requirements and re-submit the correct documents at your earliest convenience.

Thank you for your attention.

Best regards,
Admin Team
      `;
        } else if (verificationStatus === "approved") {
            doctor.documentRejectReason = "";

            emailSubject = "Document Verification Successful";
            emailMessage = `
Dear Dr. ${doctor.name},

We are pleased to inform you that your submitted documents have been successfully verified and approved.

You can now access all features available to verified doctors on our platform.

Thank you for your cooperation.

Best regards,
Admin Team
      `;
        }

        // Send email
        await sendEmail({
            to: doctor.email,
            subject: emailSubject,
            message: emailMessage,
        });

        // Save updated doctor
        await doctor.save();

        return res.status(200).json({
            message: `Documents ${verificationStatus} successfully.`,
            doctor,
        });

    } catch (error) {
        console.error("Error in verifyDoctorDocuments:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
};
