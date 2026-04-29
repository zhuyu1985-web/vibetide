// One-off: 把 auth.users.email 拷贝到 public.user_profiles.email
// 不迁 password — 自建 auth 仅支持 argon2id；旧 bcrypt 哈希不导入
// 跑过一次后可重复执行（幂等）
//
// Usage: npx tsx src/db/migrate-auth-users.ts

import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    const result = await sql`
      UPDATE public.user_profiles up
      SET email = au.email,
          updated_at = now()
      FROM auth.users au
      WHERE up.id = au.id
        AND up.email IS NULL
      RETURNING up.id, up.email;
    `;

    console.log(`✓ Migrated ${result.length} user_profiles email(s)`);
    for (const row of result) {
      console.log(`  - ${row.id} → ${row.email}`);
    }

    const remaining = await sql`
      SELECT count(*)::int AS n
      FROM public.user_profiles
      WHERE email IS NULL;
    `;
    console.log(`\n${remaining[0].n} user_profiles still without email`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
