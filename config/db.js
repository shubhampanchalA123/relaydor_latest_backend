import mongoose from "mongoose";
import createAdmin from "./createAdmin.js";   // <--- ADD THIS

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // ⭐ Auto-create admin here
    await createAdmin();

  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
