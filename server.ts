import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";

import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import sellerRoutes from "./routes/seller.routes.js";
import deliveryBoyRoutes from "./routes/deliveryBoy.routes.js";
import deliveryAdminRoutes from "./routes/admin.deliveryBoy.routes.js";
import sellerBlockRoutes from "./routes/sellerblock.routes.js";
import blockDeliveryBoyRoutes from "./routes/blockdeliveryboy.routes.js";
import medicineRoutes from "./routes/medicine.routes.js";
import doctorRoutes from "./routes/doctor.routes.js";
import locationRoutes from "./routes/location.routes.js";
const app = express();

app.use((req, res, next) => {
  console.log(`INCOMING REQUEST: ${req.method} ${req.url}`);
  next();
});

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  }),
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use(cookieParser());

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
  }),
);

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

console.log(">>> Registering Doctor Routes...");
app.use("/api/v1/doctor", doctorRoutes);
app.use("/locations", locationRoutes);
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/api/v1/medicines", medicineRoutes);
app.use("/seller", sellerRoutes);
app.use("/delivery", deliveryBoyRoutes);
app.use("/admin/delivery", deliveryAdminRoutes);
app.use("/admin/sellerblock", sellerBlockRoutes);
app.use("/admin/deliveryboy", blockDeliveryBoyRoutes);
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use((err: any, req: any, res: any, next: any) => {
  console.error("GLOBAL ERROR:", err);
  res.status(500).json({
    message: "Global error caught",
    error: err.message || String(err),
    stack: err.stack,
  });
});

app.use((req, res) => {
  console.log(`404 - Unmatched Request: ${req.method} ${req.url}`);
  res.status(404).json({ message: `Route ${req.method} ${req.url} not found` });
});

mongoose
  .connect(process.env.MONGO_URI as string)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Error:", err));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
// trigger restart
