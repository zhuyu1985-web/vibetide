import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// ---------------------------------------------------------------------------
// Singleton postgres client that survives Next.js HMR.
//
// CRITICAL: Supabase pooler in ap-southeast-1 triggers "Circuit breaker open"
// when too many auth attempts happen. Root causes:
// 1. HMR re-evaluates this module → new clients (fixed by globalThis singleton)
// 2. max pool too large → many auth attempts per process (fixed: max=1)
// 3. Multiple dev server restarts → zombie processes (user must kill stale procs)
//
// With max=1, each Next.js process uses exactly 1 persistent connection.
// The connection is pre-warmed at module load to avoid the 7-8s cold penalty.
// ---------------------------------------------------------------------------

function createClient() {
  return postgres(process.env.DATABASE_URL!, {
    prepare: false,       // Required for Supabase PgBouncer
    connect_timeout: 30,  // Allow for slow China→Singapore connection
    idle_timeout: 300,    // 5 min idle — keep alive as long as possible
    max: 2,               // 2 connections — supports parallel task execution without circuit breaker risk
    max_lifetime: 900,    // 15 min max — minimize reconnection frequency
  });
}

function createDb(c: ReturnType<typeof postgres>) {
  return drizzle(c, { schema });
}

const globalForDb = globalThis as unknown as {
  __db_client?: ReturnType<typeof postgres>;
  __db_instance?: ReturnType<typeof createDb>;
  __db_warmed?: boolean;
};

const client = globalForDb.__db_client ?? createClient();
export const db = globalForDb.__db_instance ?? createDb(client);

if (process.env.NODE_ENV !== "production") {
  globalForDb.__db_client = client;
  globalForDb.__db_instance = db;
}

// Pre-warm the single connection at module load
if (!globalForDb.__db_warmed && process.env.DATABASE_URL) {
  globalForDb.__db_warmed = true;
  client`SELECT 1`.catch(() => {});
}
