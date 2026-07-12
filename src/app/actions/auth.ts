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
} from "@/lib/auth";
import {
  hashPhone,
  isValidPhone,
  normalizePhone,
  preparePhoneForStorage,
} from "@/lib/phone-crypto";

const CREDENTIAL_ERROR = "账号或密码错误";

function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

async function authenticateProfile(
  profile: {
    id: string;
    organizationId: string | null;
    displayName: string;
    isSuperAdmin: boolean;
    passwordHash: string | null;
  } | undefined,
  password: string,
) {
  if (!profile || !profile.passwordHash || !profile.organizationId) {
    return { error: CREDENTIAL_ERROR } as const;
  }

  const ok = await verifyPassword(password, profile.passwordHash);
  if (!ok) {
    return { error: CREDENTIAL_ERROR } as const;
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

export async function signIn(formData: FormData) {
  const loginMode = (formData.get("loginMode") as string) ?? "phone";
  const password = (formData.get("password") as string) ?? "";

  if (!password) {
    return { error: CREDENTIAL_ERROR };
  }

  if (loginMode === "phone") {
    const phone = normalizePhone(formData.get("phone") as string);
    if (!isValidPhone(phone)) {
      return { error: CREDENTIAL_ERROR };
    }

    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.phoneHash, hashPhone(phone)),
    });

    return authenticateProfile(profile, password);
  }

  const email = normalizeEmail(formData.get("email") as string);
  if (!email) {
    return { error: CREDENTIAL_ERROR };
  }

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.email, email),
  });

  return authenticateProfile(profile, password);
}

export async function signUp(formData: FormData) {
  const email = normalizeEmail(formData.get("email") as string);
  const password = (formData.get("password") as string) ?? "";
  const phone = normalizePhone(formData.get("phone") as string);
  const displayName =
    (formData.get("displayName") as string)?.trim() || email.split("@")[0];

  if (!email || !password || !phone) {
    return { error: "邮箱、手机号和密码必填" };
  }
  if (!isValidPhone(phone)) {
    return { error: "请输入有效的 11 位手机号" };
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

  const phoneHash = preparePhoneForStorage(phone).phoneHash;
  const existingPhone = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.phoneHash, phoneHash),
  });
  if (existingPhone) {
    return { error: "该手机号已被注册" };
  }

  const defaultOrg = await db.query.organizations.findFirst({
    orderBy: (o, { asc }) => [asc(o.createdAt)],
  });
  if (!defaultOrg) {
    return { error: "系统未初始化默认组织，请联系管理员" };
  }

  const userId = randomUUID();
  const passwordHash = await hashPassword(password);

  const storedPhone = preparePhoneForStorage(phone);

  await db.insert(userProfiles).values({
    id: userId,
    organizationId: defaultOrg.id,
    displayName,
    email,
    phone: storedPhone.phone,
    phoneHash: storedPhone.phoneHash,
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
  redirect("/auth/logout");
}
