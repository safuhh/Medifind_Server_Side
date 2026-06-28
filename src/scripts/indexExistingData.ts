/**
 * One-time migration script to index all existing health data into HealthChunk collection.
 * Run with: npx tsx src/scripts/indexExistingData.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { HealthReport } from "../models/healthReport.model.js";
import { DoctorBooking } from "../models/doctor.booking.model.js";
import { Order } from "../models/order.model.js";
import { FamilyMember } from "../models/familyMember.model.js";
import { DoctorApplication } from "../models/doctor.model.js";
import { Medicine } from "../models/medicine.model.js";
import { EmbeddingService } from "../services/embedding.service.js";

const BATCH_SIZE = 5; // Small batch to stay within rate limits
const DELAY_MS = 500; // Delay between batches (ms)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function indexHealthReports() {
  console.log("\n📋 Indexing health reports...");
  const reports = await HealthReport.find({}).lean();
  let count = 0;

  for (let i = 0; i < reports.length; i += BATCH_SIZE) {
    const batch = reports.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (report) => {
        try {
          await EmbeddingService.indexHealthReport(report, report.patientId.toString());
          count++;
        } catch (e: any) {
          console.error(`  ✗ Failed report ${report._id}: ${e.message}`);
        }
      })
    );
    process.stdout.write(`  Progress: ${Math.min(i + BATCH_SIZE, reports.length)}/${reports.length}\r`);
    await sleep(DELAY_MS);
  }
  console.log(`\n  ✅ Indexed ${count} health reports`);
}

async function indexBookings() {
  console.log("\n📅 Indexing bookings...");
  const bookings = await DoctorBooking.find({}).populate("doctorId", "fullName").lean();
  let count = 0;

  for (let i = 0; i < bookings.length; i += BATCH_SIZE) {
    const batch = bookings.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (booking) => {
        try {
          const doctorName = (booking.doctorId as any)?.fullName;
          await EmbeddingService.indexBooking(booking, booking.userId.toString(), doctorName);
          count++;
        } catch (e: any) {
          console.error(`  ✗ Failed booking ${booking._id}: ${e.message}`);
        }
      })
    );
    process.stdout.write(`  Progress: ${Math.min(i + BATCH_SIZE, bookings.length)}/${bookings.length}\r`);
    await sleep(DELAY_MS);
  }
  console.log(`\n  ✅ Indexed ${count} bookings`);
}

async function indexOrders() {
  console.log("\n💊 Indexing orders...");
  const orders = await Order.find({ paymentStatus: "paid" }).populate("items.medicineId", "name").lean();
  let count = 0;

  for (let i = 0; i < orders.length; i += BATCH_SIZE) {
    const batch = orders.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (order) => {
        try {
          const medicineNames = order.items
            .map((item: any) => (item.medicineId as any)?.name || "Unknown")
            .filter(Boolean);
          await EmbeddingService.indexOrder(order, order.userId.toString(), medicineNames);
          count++;
        } catch (e: any) {
          console.error(`  ✗ Failed order ${order._id}: ${e.message}`);
        }
      })
    );
    process.stdout.write(`  Progress: ${Math.min(i + BATCH_SIZE, orders.length)}/${orders.length}\r`);
    await sleep(DELAY_MS);
  }
  console.log(`\n  ✅ Indexed ${count} orders`);
}

async function indexFamilyMembers() {
  console.log("\n👨‍👩‍👧 Indexing family members...");
  const members = await FamilyMember.find({}).lean();
  let count = 0;

  for (let i = 0; i < members.length; i += BATCH_SIZE) {
    const batch = members.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (member) => {
        try {
          await EmbeddingService.indexFamilyMember(member as any, member.primaryUserId.toString());
          count++;
        } catch (e: any) {
          console.error(`  ✗ Failed member ${member._id}: ${e.message}`);
        }
      })
    );
    await sleep(DELAY_MS);
  }
  console.log(`  ✅ Indexed ${count} family member profiles`);
}

async function main() {
  console.log("🚀 MediFind RAG Indexing Script Starting...");
  console.log("Connecting to MongoDB...");

  await mongoose.connect(process.env.MONGO_URI as string);
  console.log("✅ MongoDB Connected\n");

  await indexHealthReports();
  await indexBookings();
  await indexOrders();
  await indexFamilyMembers();

  console.log("\n✅ All data indexed successfully!");
  console.log("\n📌 Next step: Create the Atlas Vector Search index in MongoDB Atlas:");
  console.log(`{
  "fields": [{
    "type": "vector",
    "path": "embedding",
    "numDimensions": 768,
    "similarity": "cosine"
  }, {
    "type": "filter",
    "path": "primaryUserId"
  }, {
    "type": "filter",
    "path": "familyMemberId"
  }]
}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal indexing error:", err);
  process.exit(1);
});
