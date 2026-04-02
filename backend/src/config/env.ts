import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).default("postgresql://postgres:postgres@localhost:5432/statqa"),
  JWT_SECRET: z.string().min(8).default("change-me"),
  MAX_PAGES: z.coerce.number().int().positive().default(20),
  MAX_DEPTH: z.coerce.number().int().nonnegative().default(2),
  ANALYSIS_CONCURRENCY: z.coerce.number().int().positive().default(3)
});

export const env = envSchema.parse(process.env);

