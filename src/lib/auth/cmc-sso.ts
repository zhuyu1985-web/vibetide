import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { organizations, userProfiles } from "@/db/schema";
import { hashPassword } from "@/lib/auth/hash";
import type { SessionPayload } from "@/lib/auth/session";
import {
  fetchCmcGroupUser,
} from "@/lib/auth/cmc-console-client";
import {
  hashPhone,
  isValidPhone,
  normalizePhone,
  preparePhoneForStorage,
} from "@/lib/phone-crypto";

export type SsoIdentity = {
  displayName: string;
  phone: string;
  source: "xn_userInfo" | "cmc_api";
};

export type SsoCookieInput = {
  xnUserInfo?: string | null;
  loginCmcId?: string | null;
  loginCmcTid?: string | null;
};

const XnUserInfoSchema = z.object({
  account: z.string().min(1),
  phone: z.string().min(1),
});

export class SsoIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsoIdentityError";
  }
}

export function safeNextPath(next: string | null | undefined): string {
  if (!next) return "/home";
  const trimmed = next.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/home";
  }
  return trimmed;
}

export function parseXnUserInfo(raw: string | null | undefined): SsoIdentity {
  if (!raw?.trim()) {
    throw new SsoIdentityError("xn_userInfo 为空");
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    try {
      json = JSON.parse(decodeURIComponent(raw));
    } catch {
      throw new SsoIdentityError("xn_userInfo 不是有效 JSON");
    }
  }

  const parsed = XnUserInfoSchema.safeParse(json);
  if (!parsed.success) {
    throw new SsoIdentityError("xn_userInfo 缺少 account 或 phone");
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!isValidPhone(phone)) {
    throw new SsoIdentityError("xn_userInfo.phone 不是有效手机号");
  }

  return {
    displayName: parsed.data.account.trim(),
    phone,
    source: "xn_userInfo",
  };
}

export async function resolveSsoIdentity(
  cookies: SsoCookieInput,
): Promise<SsoIdentity> {
  if (cookies.xnUserInfo?.trim()) {
    return parseXnUserInfo(cookies.xnUserInfo);
  }

  const loginCmcId = cookies.loginCmcId?.trim();
  const loginCmcTid = cookies.loginCmcTid?.trim();
  if (!loginCmcId || !loginCmcTid) {
    throw new SsoIdentityError("缺少 SSO 身份 cookie");
  }

  let userInfo;
  try {
    userInfo = await fetchCmcGroupUser(loginCmcId, loginCmcTid);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "CMC 用户信息获取失败";
    throw new SsoIdentityError(message);
  }

  const phone = normalizePhone(userInfo.user_mobile);
  if (!isValidPhone(phone)) {
    throw new SsoIdentityError("CMC user_mobile 不是有效手机号");
  }

  return {
    displayName: userInfo.login_name.trim(),
    phone,
    source: "cmc_api",
  };
}

function getSsoDefaultPassword(): string {
  return process.env.CMC_SSO_DEFAULT_PASSWORD?.trim() || "@.Mcloud2026";
}

async function getDefaultOrganizationId(): Promise<string> {
  const defaultOrg = await db.query.organizations.findFirst({
    orderBy: (o, { asc }) => [asc(o.createdAt)],
  });
  if (!defaultOrg) {
    throw new SsoIdentityError("系统未初始化默认组织，请联系管理员");
  }
  return defaultOrg.id;
}

async function findUserByPhoneHash(phoneHash: string) {
  return db.query.userProfiles.findFirst({
    where: eq(userProfiles.phoneHash, phoneHash),
  });
}

export async function findOrProvisionUserByPhone(
  identity: Pick<SsoIdentity, "displayName" | "phone">,
): Promise<SessionPayload> {
  const phoneHash = hashPhone(identity.phone);
  const existing = await findUserByPhoneHash(phoneHash);

  if (existing?.organizationId && existing.passwordHash) {
    await db
      .update(userProfiles)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(userProfiles.id, existing.id));

    return {
      id: existing.id,
      organizationId: existing.organizationId,
      displayName: existing.displayName,
      isSuperAdmin: existing.isSuperAdmin,
    };
  }

  const organizationId = await getDefaultOrganizationId();
  const userId = randomUUID();
  const passwordHash = await hashPassword(getSsoDefaultPassword());
  const storedPhone = preparePhoneForStorage(identity.phone);

  try {
    await db.insert(userProfiles).values({
      id: userId,
      organizationId,
      displayName: identity.displayName,
      email: null,
      phone: storedPhone.phone,
      phoneHash: storedPhone.phoneHash,
      passwordHash,
      passwordHashAlgo: "argon2id",
    });
  } catch {
    const raced = await findUserByPhoneHash(phoneHash);
    if (raced?.organizationId && raced.passwordHash) {
      await db
        .update(userProfiles)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(userProfiles.id, raced.id));

      return {
        id: raced.id,
        organizationId: raced.organizationId,
        displayName: raced.displayName,
        isSuperAdmin: raced.isSuperAdmin,
      };
    }
    throw new SsoIdentityError("自动注册失败，请稍后重试");
  }

  return {
    id: userId,
    organizationId,
    displayName: identity.displayName,
    isSuperAdmin: false,
  };
}

export function hasSsoCookies(input: SsoCookieInput): boolean {
  if (input.xnUserInfo?.trim()) return true;
  return !!(input.loginCmcId?.trim() && input.loginCmcTid?.trim());
}

export function isCmcConsoleError(err: unknown): boolean {
  return err instanceof Error && err.name === "CmcConsoleError";
}
