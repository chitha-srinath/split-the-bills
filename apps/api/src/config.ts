import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Attempt to load .env from process.cwd(), apps/api/.env, and repo root .env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must contain at least 32 characters"),
  BETTER_AUTH_URL: z
    .string()
    .url("BETTER_AUTH_URL must be a valid URL")
    .default("http://localhost:4000"),
  CLIENT_ORIGIN: z
    .string()
    .url("CLIENT_ORIGIN must be a valid URL")
    .default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
});

export type Env = z.infer<typeof envSchema>;
export type Config = Env;

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const formattedErrors = result.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  // eslint-disable-next-line no-console
  console.error(`❌ Invalid environment configuration:\n${formattedErrors}\n`);
  throw new Error(`Invalid environment configuration:\n${formattedErrors}`);
}

export const env: Env = result.data;
export const config: Config = result.data;

export default config;
