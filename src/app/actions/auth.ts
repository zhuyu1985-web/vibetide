"use server";

import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userProfiles, organizations } from "@/db/schema";
import {
  hashPassword,
  verifyPassword,
  setSession,
  destroySession,
} from "@/lib/auth";

const CREDENTIAL_ERROR = "邮箱或密码错误";

function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

export async function signIn(formData: FormData) {
  const email = normalizeEmail(formData.get("email") as string);
  const password = (formData.get("password") as string) ?? "";

  if (!email || !password) {
    return { error: CREDENTIAL_ERROR };
  }

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.email, email),
  });

  if (!profile || !profile.passwordHash || !profile.organizationId) {
    return { error: CREDENTIAL_ERROR };
  }

  const ok = await verifyPassword(password, profile.passwordHash);
  if (!ok) {
    return { error: CREDENTIAL_ERROR };
  }

  await db
    .update(userProfiles)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(userProfiles.id, profile.id));

  await setSession({
    id: profile.id,
    organizationId: profile.organizationId,
    displayName: profile.displayName,
    isSuperAdmin: profile.isSuperAdmin,
  });

  redirect("/home");
}

export async function signUp(formData: FormData) {
  const email = normalizeEmail(formData.get("email") as string);
  const password = (formData.get("password") as string) ?? "";
  const displayName =
    (formData.get("displayName") as string)?.trim() || email.split("@")[0];

  if (!email || !password) {
    return { error: "邮箱和密码必填" };
  }
  if (password.length < 8) {
    return { error: "密码至少 8 位" };
  }

  const existing = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.email, email),
  });
  if (existing) {
    return { error: "该邮箱已被注册" };
  }

  const defaultOrg = await db.query.organizations.findFirst({
    orderBy: (o, { asc }) => [asc(o.createdAt)],
  });
  if (!defaultOrg) {
    return { error: "系统未初始化默认组织，请联系管理员" };
  }

  const userId = randomUUID();
  const passwordHash = await hashPassword(password);

  await db.insert(userProfiles).values({
    id: userId,
    organizationId: defaultOrg.id,
    displayName,
    email,
    passwordHash,
    passwordHashAlgo: "argon2id",
  });

  await setSession({
    id: userId,
    organizationId: defaultOrg.id,
    displayName,
    isSuperAdmin: false,
  });

  redirect("/home");
}

export async function signOut() {
  await destroySession();
  redirect("/login");
}
