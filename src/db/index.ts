import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// ---------------------------------------------------------------------------
// Singleton postgres client that survives Next.js HMR。
//
// DATABASE_URL 可指向:
//   - 本地 PG(127.0.0.1 / localhost):直连模式,享受 prepared statement 加速
//   - Supabase / Sealos pooler(远程域名):走 PgBouncer transaction mode,必须 prepare:false
// 用 globalThis 单例,避免 HMR 重复创建客户端导致连接泄漏。
// ---------------------------------------------------------------------------

// 自动识别本地直连 PG → prepare:true 享受 prepared statement;远程 pooler → prepare:false 保守。
const DB_URL = process.env.DATABASE_URL ?? "";
const isLocalDb = /\/\/[^/]*?(127\.0\.0\.1|localhost)/i.test(DB_URL);

function createClient() {
  return postgres(DB_URL, {
    prepare: isLocalDb,   // 本地直连用 prepared statement;PgBouncer transaction mode 必须 false
    connect_timeout: 10,  // 10s 兜底,吸收偶发慢握手
    idle_timeout: 300,    // 5 min idle — 保活减少 reconnect
    max: 10,              // home/page.tsx 一次发 10 个 tab 模板查询 + layout 2 个并发,放宽到 10 避免排队
    max_lifetime: 900,    // 15 min — 减少 reconnect 频率
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
