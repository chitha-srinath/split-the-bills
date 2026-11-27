import mongoose from "mongoose";
import { env } from "./config.js";

export async function connectToDatabase() {
  await mongoose.connect(env.MONGODB_URI);
}

export async function disconnectFromDatabase() {
  await mongoose.disconnect();
}
