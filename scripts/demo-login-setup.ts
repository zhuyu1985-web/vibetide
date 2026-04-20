/**
 * 一次性 demo 登录环境准备：
 * 1. 用 Supabase admin API 创建 demo@vibetide.local / DemoPass123!
 *    （如已存在则更新密码）
 * 2. 在 public.user_profiles 里插入/更新该用户的 profile 到主 org
 * 3. 回滚先前错误插入的 1c2b3615 profile
 *
 * 跑完后用 email + 密码登录即可。
 */
import { createClient as createAdmin } from "@supabase/supabase-js";
import { db } from "../src/db";
import { userProfiles } from "../src/db/schema/users";
import { eq } from "drizzle-orm";

const EMAIL = "demo@vibetide.local";
const PASSWORD = "DemoPass123!";
const ORG_ID = "a0000000-0000-4000-8000-000000000001";

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Rollback: 删除之前错误插入的 profile
  const BAD_ID = "1c2b3615-aa7f-4d5e-931d-c09182b16546";
  await db.delete(userProfiles).where(eq(userProfiles.id, BAD_ID));
  console.log(`rolled back profile ${BAD_ID}`);

  // 1. 创建或复用 auth user
  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list.users.find((u) => u.email === EMAIL);
  let userId: string;
  if (existing) {
    userId = existing.id;
    await admin.auth.admin.updateUserById(userId, { password: PASSWORD });
    console.log(`updated existing auth user ${userId}`);
  } else {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error || !created.user) throw error ?? new Error("createUser returned empty");
    userId = created.user.id;
    console.log(`created new auth user ${userId}`);
  }

  // 2. upsert profile
  await db
    .insert(userProfiles)
    .values({
      id: userId,
      organizationId: ORG_ID,
      displayName: "Demo 管理员",
      role: "admin",
      isSuperAdmin: true,
    })
    .onConflictDoUpdate({
      target: userProfiles.id,
      set: {
        organizationId: ORG_ID,
        displayName: "Demo 管理员",
        role: "admin",
        isSuperAdmin: true,
      },
    });
  console.log(`upserted user_profiles for ${userId}`);
  console.log(`\nready. 登录凭证：\n  email:    ${EMAIL}\n  password: ${PASSWORD}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
