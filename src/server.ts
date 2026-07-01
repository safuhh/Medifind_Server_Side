import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { createServer } from "http";
import mainRouter from "./app.js";
import { initSocket } from "./sockets/socket.js";

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);

// Initialize Socket.io
initSocket(httpServer, app);

app.use((req, res, next) => {
  console.log(`INCOMING REQUEST: ${req.method} ${req.url}`);
  next();
});

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
const allowedOrigins = [
  "https://medifind-client-side.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use(cookieParser());

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000, // Increased for testing to prevent 429 errors
  }),
);

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Medifind API Running Successfully 🚀",
  });
});

// Use central router
app.use("/api", mainRouter);

// Serve static files
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error("GLOBAL ERROR:", err);
  res.status(500).json({
    message: "Global error caught",
    error: err.message || String(err),
    stack: err.stack,
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`404 - Unmatched Request: ${req.method} ${req.url}`);
  res.status(404).json({ message: `Route ${req.method} ${req.url} not found` });
});

console.log("Connecting to MongoDB...");
mongoose
  .connect(process.env.MONGO_URI as string, {
    serverSelectionTimeoutMS: 5000,
  })
  .then(() => console.log(" MongoDB Connected"))
  .catch((err) => {
    console.error(" MongoDB Error:", err);
    process.exit(1);
  });

// Port configuration (defaults to 5000)
const PORT = process.env.PORT || 5000;

httpServer.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(` Port ${PORT} is already in use.`);
    console.error(" Stop the process using port 5000, then restart backend.");
    process.exit(1);
  }

  console.error(" Failed to start server:", error.message);
  process.exit(1);
});

console.log(` Starting server on port ${PORT}...`);
httpServer.listen(PORT, () => {
  console.log(` Server running on port ${PORT}.`);
});
