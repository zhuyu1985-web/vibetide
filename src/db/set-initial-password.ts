// One-off: 给指定 email 的 user_profile 设置 argon2id 密码
//
// Usage: npx tsx src/db/set-initial-password.ts <email> '<password>'
// Example: npx tsx src/db/set-initial-password.ts zhuyu1985@gmail.com 'MyPass123!'

import postgres from "postgres";
import { hash } from "@node-rs/argon2";
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const [, , email, password] = process.argv;
  if (!email || !password) {
    console.error("Usage: npx tsx src/db/set-initial-password.ts <email> '<password>'");
    process.exit(2);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters");
    process.exit(2);
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  // Defaults to Argon2id; explicit cost params: m=19MiB, t=2, p=1
  const passwordHash = await hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    const result = await sql`
      UPDATE public.user_profiles
      SET password_hash = ${passwordHash},
          password_hash_algo = 'argon2id',
          updated_at = now()
      WHERE email = ${email}
      RETURNING id, email;
    `;

    if (result.length === 0) {
      console.error(`✗ No user_profile found with email = ${email}`);
      process.exit(1);
    }

    console.log(`✓ Password updated for ${result[0].email} (id=${result[0].id})`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
