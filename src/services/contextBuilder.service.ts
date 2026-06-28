import { HealthReport } from "../models/healthReport.model.js";
import { DoctorBooking } from "../models/doctor.booking.model.js";
import { Order } from "../models/order.model.js";
import { FamilyMember } from "../models/familyMember.model.js";
import { DoctorApplication } from "../models/doctor.model.js";
import { Medicine } from "../models/medicine.model.js";

export interface ContextChunk {
  sourceCollection: string;
  sourceId: string;
  excerpt: string;
  memberName?: string;
  date?: Date;
}

export class ContextBuilderService {
  /**
   * Build structured context string from retrieved chunks + direct DB queries.
   */
  static async buildContext(params: {
    primaryUserId: string;
    familyMemberId?: string;
    memberName?: string;
    retrievedChunks: any[];
  }): Promise<{ contextText: string; citations: ContextChunk[] }> {
    const { primaryUserId, familyMemberId, memberName, retrievedChunks } = params;
    const citations: ContextChunk[] = [];
    const sections: string[] = [];

    // --- Section 1: Directly retrieved semantic chunks ---
    if (retrievedChunks.length > 0) {
      const chunkLines = retrievedChunks.map((chunk, i) => {
        const citation: ContextChunk = {
          sourceCollection: chunk.sourceCollection,
          sourceId: chunk.sourceId,
          excerpt: chunk.chunkText.slice(0, 100),
        };
        if (chunk.memberName) citation.memberName = chunk.memberName;
        if (chunk.metadata?.date) citation.date = chunk.metadata.date;
        citations.push(citation);
        return `[Record ${i + 1}] ${chunk.chunkText}`;
      });
      sections.push(`## Retrieved Health Records\n${chunkLines.join("\n")}`);
    }

    // --- Section 2: Direct DB – Latest prescriptions ---
    const reportFilter: any = { patientId: primaryUserId };
    if (familyMemberId) reportFilter.familyMemberId = familyMemberId;
    
    const latestReport = await HealthReport.findOne(reportFilter)
      .populate("doctorId", "fullName specialization")
      .sort({ createdAt: -1 });

    if (latestReport) {
      const doctorInfo = (latestReport.doctorId as any)?.fullName || "Unknown Doctor";
      const medsList = (latestReport.medicines || [])
        .map((m) => `  - ${m.name}: ${m.dosage}, ${m.timesPerDay || ""}, Qty: ${m.quantity}`)
        .join("\n");
      sections.push(
        `## Latest Prescription (${new Date(latestReport.createdAt).toLocaleDateString()})\nDoctor: ${doctorInfo}\nDiagnosis: ${(latestReport as any).diagnosisText || "Not recorded"}\nNotes: ${latestReport.notes}\nMedicines:\n${medsList || "None prescribed"}`
      );
      const citation: ContextChunk = {
        sourceCollection: "healthReport",
        sourceId: latestReport._id.toString(),
        excerpt: `Latest health report from ${new Date(latestReport.createdAt).toLocaleDateString()}`,
      };
      if (memberName) citation.memberName = memberName;
      if (latestReport.createdAt) citation.date = latestReport.createdAt;
      citations.push(citation);
    }

    // --- Section 3: Direct DB – Upcoming/recent appointments ---
    const bookingFilter: any = { userId: primaryUserId };
    if (familyMemberId) bookingFilter.familyMemberId = familyMemberId;
    const recentBookings = await DoctorBooking.find(bookingFilter)
      .populate("doctorId", "fullName specialization")
      .sort({ date: -1 })
      .limit(3);

    if (recentBookings.length > 0) {
      const bookingLines = recentBookings.map((b) => {
        const doc = (b.doctorId as any)?.fullName || "Unknown";
        return `  - ${new Date(b.date).toLocaleDateString()} at ${b.timeSlot} with Dr. ${doc} (${b.status}, ${b.paymentStatus})`;
      });
      sections.push(`## Recent Appointments\n${bookingLines.join("\n")}`);
    }

    // --- Section 4: Direct DB – Recent orders ---
    const orderFilter: any = { userId: primaryUserId, paymentStatus: "paid" };
    if (familyMemberId) orderFilter.familyMemberId = familyMemberId;
    const recentOrders = await Order.find(orderFilter)
      .populate("items.medicineId", "name brand")
      .sort({ createdAt: -1 })
      .limit(3);

    if (recentOrders.length > 0) {
      const orderLines = recentOrders.map((o) => {
        const items = o.items.map((i: any) => `${(i.medicineId as any)?.name || "?"} ×${i.quantity}`).join(", ");
        return `  - ${new Date(o.createdAt).toLocaleDateString()}: ${items} (₹${o.totalAmount}, ${o.orderStatus})`;
      });
      sections.push(`## Recent Medicine Purchases\n${orderLines.join("\n")}`);
    }

    // --- Section 5: Family member profile if applicable ---
    if (familyMemberId) {
      const member = await FamilyMember.findById(familyMemberId);
      if (member) {
        const profileLines = [
          `Name: ${member.name} (${member.relationship})`,
          member.dateOfBirth ? `DOB: ${new Date(member.dateOfBirth).toLocaleDateString()}` : null,
          member.bloodGroup ? `Blood Group: ${member.bloodGroup}` : null,
          member.allergies?.length ? `Allergies: ${member.allergies.join(", ")}` : "No known allergies",
          member.chronicDiseases?.length ? `Chronic conditions: ${member.chronicDiseases.join(", ")}` : "No chronic conditions",
        ].filter(Boolean);
        sections.push(`## Family Member Profile\n${profileLines.join("\n")}`);
      }
    }

    const contextText = sections.join("\n\n");
    return { contextText, citations };
  }
}
