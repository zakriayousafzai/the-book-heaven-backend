import { config } from "dotenv";
import process from "node:process";

config();

const listFromEnv = (value) =>
  value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

export const {
  PORT = 5000,
  DB_URI,
  CLERK_PUBLISHABLE_KEY,
  CLERK_SECRET_KEY,
  NODE_ENV = "development",
  CORS_ORIGIN,
} = process.env;

export const isProduction = NODE_ENV === "production";
export const corsOrigins = listFromEnv(CORS_ORIGIN);
