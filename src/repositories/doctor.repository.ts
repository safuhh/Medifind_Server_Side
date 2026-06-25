import { DoctorApplication } from "../models/doctor.model.js";
import { User } from "../models/user.model.js";

export class DoctorRepository {
  static async findExistingApplication(userId: string) {
    return await DoctorApplication.findOne({ userId });
  }

  static async findByRegistrationNumber(registrationNumber: string) {
    return await DoctorApplication.findOne({ registrationNumber });
  }

  static async createApplication(applicationData: any) {
    return await DoctorApplication.create(applicationData);
  }

  static async findApplicationById(id: string) {
    return await DoctorApplication.findById(id);
  }

  static async getAllApplications() {
    return await DoctorApplication.find().sort({ createdAt: -1 });
  }

  static async saveApplication(application: any) {
    return await application.save({ validateBeforeSave: false });
  }

  static async updateUserRole(userId: string, role: string) {
    const user = await User.findById(userId);
    if (user) {
      user.role = role as any;
      await user.save();
    }
    return user;
  }
}
