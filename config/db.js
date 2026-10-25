import mongoose from "mongoose";
import process from "node:process";
import { DB_URI } from "./env.js";

const connectToDatabase = async () => {
  if (!DB_URI) {
    throw new Error(
      "DB_URI is not defined. Copy .env.example to .env and add your MongoDB connection string.",
    );
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(DB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log("Connected to MongoDB");
};

export const disconnectFromDatabase = async () => {
  await mongoose.disconnect();
};

export default connectToDatabase;
