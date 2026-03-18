import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// { prepare: false } is required for Supabase's connection pooler (PgBouncer)
const client = postgres(connectionString, {
  prepare: false,
  connect_timeout: 30,
  idle_timeout: 120,
  max: 3,
});
export const db = drizzle(client, { schema });

// Pre-warm connection pool at module load — avoids 5-8s cold-connect penalty on first request
if (typeof globalThis !== "undefined" && process.env.DATABASE_URL) {
  const key = "__db_pool_warmed";
  if (!(globalThis as Record<string, unknown>)[key]) {
    (globalThis as Record<string, unknown>)[key] = true;
    Promise.all([client`SELECT 1`, client`SELECT 1`, client`SELECT 1`]).catch(
      () => {}
    );
  }
}
