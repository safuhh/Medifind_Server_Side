import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "./models/user.model.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://safuhh:safvanmkd123@cluster0.ld2eeg1.mongodb.net/single";

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    // Find the first seller to update
    const user = await User.findOne({ role: "seller" });
    
    if (!user) {
      console.log("No seller found in database");
      process.exit(0);
    }

    const enabledAccountId = "acct_1TWqlw1mhY1QS9CS";
    user.stripeAccountId = enabledAccountId;
    await user.save();

    console.log(`Successfully updated seller ${user.email} with Stripe Account ID: ${enabledAccountId}`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
