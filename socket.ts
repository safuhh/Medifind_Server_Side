import { Server } from "socket.io";
import { Server as HttpServer } from "http";

export const initSocket = (httpServer: HttpServer, app: any) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:3000",
      credentials: true,
    },
  });

  app.set("io", io);

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join_doctor_room", (id) => {
      socket.join(id);
      console.log(`User ${socket.id} joined room: ${id}`);
    });

    socket.on("join_seller_room", (sellerId) => {
      socket.join(sellerId);
      console.log(`Seller ${socket.id} joined room: ${sellerId}`);
    });

    socket.on("notify_patient", (data) => {
      const { patientId, roomId, doctorName } = data;
      io.to(patientId).emit("consultation_started", { roomId, doctorName });
      console.log(`Doctor notified patient ${patientId} about room ${roomId}`);
    });

    // Delivery live tracking
    socket.on("join_delivery_room", (orderId) => {
      socket.join(orderId);
      console.log(`Delivery/User joined order room: ${orderId}`);
    });

    socket.on("update_delivery_location", (data) => {
      const { orderId, location } = data;
      io.to(orderId).emit("delivery_location_updated", location);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected");
    });
  });

  return io;
};
