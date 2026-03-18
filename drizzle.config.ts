import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
