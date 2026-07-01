import { Server } from "socket.io";
import { Server as HttpServer } from "http";

export const initSocket = (httpServer: HttpServer, app: any) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "https://medifind-client-side.vercel.app",
      credentials: true,
    },
  });

  app.set("io", io);

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join_doctor_private_room", (id) => {
      socket.join(id);
      console.log(`User ${socket.id} joined doctor private room: ${id}`);
    });

    socket.on("join_consultation_room", (roomId) => {
      socket.join(roomId);
      console.log(`User ${socket.id} joined consultation room: ${roomId}`);
    });

    socket.on("join_user_room", (userId) => {
      socket.join(userId);
      console.log(`User ${socket.id} joined user room: ${userId}`);
    });

    socket.on("join_seller_room", (sellerId) => {
      socket.join(sellerId);
      console.log(`Seller ${socket.id} joined room: ${sellerId}`);
    });

    socket.on("join_delivery_boy_room", (userId) => {
      socket.join(`delivery_boy_${userId}`);
      console.log(`Delivery Boy ${socket.id} joined room: delivery_boy_${userId}`);
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
