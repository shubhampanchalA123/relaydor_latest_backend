import User from "../models/UserModel.js";
import bcrypt from "bcryptjs";

const createAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || "Admin";

    // already exists?
    const exists = await User.findOne({ email: adminEmail });

    if (exists) {
      console.log("Admin already exists");
      return;
    }

    // create admin
    const hashed = await bcrypt.hash(adminPassword, 12);

    await User.create({
      name: adminName,
      email: adminEmail,
      password: hashed,
      mobile: "0000000000",
      userRole: "admin",
      emailVerified: true,
      mobileVerified: true,
      verified: true,
    });

    console.log("Admin created successfully!");
  } catch (err) {
    console.log("Admin Create Error:", err);
  }
};

export default createAdmin;
