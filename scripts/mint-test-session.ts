/**
 * 一次性生成有效的 vibetide-session cookie 字符串(用 iron-session sealData)。
 * 用 stdout 输出,方便 curl --cookie 用。
 *
 * 用法:npx tsx scripts/mint-test-session.ts <accountIdOrEmail?>
 *   默认使用 DB 里第一个 super admin 用户的身份。
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { sealData } from "iron-session";

async function main() {
  const target = process.argv[2];
  const password = process.env.AUTH_SESSION_SECRET;
  if (!password || password.length < 32) {
    console.error("AUTH_SESSION_SECRET 缺失或太短");
    process.exit(1);
  }
  const ttl = Number(process.env.AUTH_SESSION_TTL_SECONDS ?? 604800);

  const postgres = (await import("postgres")).default;
  const dburl = process.env.DATABASE_URL!.replace(/[?&]directConnection=true/i, "").replace(/\?$/, "");
  const sql = postgres(dburl, { prepare: false });

  let where = "is_super_admin = true";
  if (target) {
    where = target.includes("@")
      ? `email = '${target.replace(/'/g, "''")}'`
      : `id = '${target}'`;
  }
  const rows = await sql.unsafe(
    `SELECT id::text, organization_id::text, display_name, is_super_admin FROM user_profiles WHERE ${where} LIMIT 1`,
  );
  await sql.end();

  if (rows.length === 0) {
    console.error("找不到匹配用户");
    process.exit(2);
  }
  const u = rows[0]!;
  const sealed = await sealData(
    {
      id: u.id,
      organizationId: u.organization_id,
      displayName: u.display_name ?? "",
      isSuperAdmin: !!u.is_super_admin,
    },
    { password, ttl },
  );
  process.stdout.write(sealed);
}

void main();
