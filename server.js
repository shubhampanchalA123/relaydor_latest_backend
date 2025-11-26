import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import authRoutes from "./routes/authRoutes.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

// Load ENV
dotenv.config();

// Connect DB
connectDB();

const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// Middleware to expose io via app.locals for routes and controllers
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Middlewares
app.use(cors());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(compression());
app.use(morgan("dev"));

// Rate limiter
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: "Too many requests",
  })
);

// Serve static files from public directory
app.use(express.static('public'));

// Health check
app.get("/", (req, res) => {
  res.json({ success: true, message: "API Running 🚀" });
});



// Register routes
app.use("/api/auth", authRoutes);
app.use("/api/doctor", doctorRoutes);
app.use("/api/patients", patientRoutes);




// admin routes can be added here
app.use("/api/admin", adminRoutes);

// 404 Handler (IMPORTANT: MUST BE AFTER ROUTES)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found - ${req.originalUrl}`,
  });
});

// Error handler (last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
