import { createHmac } from "node:crypto";
import { decrypt, encrypt } from "@/lib/crypto";

const PHONE_HASH_KEY =
  process.env.PHONE_HASH_KEY ||
  process.env.PLUGIN_ENCRYPTION_KEY ||
  "default-32-byte-key-for-dev-0000";

/** iv:ciphertext hex — 与 crypto.ts encrypt 输出一致 */
const ENCRYPTED_PHONE_PATTERN = /^[0-9a-f]{32}:[0-9a-f]+$/i;

export function normalizePhone(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

export function isValidPhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

export function hashPhone(phone: string): string {
  return createHmac("sha256", PHONE_HASH_KEY).update(phone).digest("hex");
}

export function encryptPhone(phone: string): string {
  return encrypt(phone);
}

/** 兼容未加密的旧明文数据 */
export function decryptPhone(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!ENCRYPTED_PHONE_PATTERN.test(stored)) {
    return stored;
  }
  return decrypt(stored);
}

export function maskPhone(phone: string): string {
  if (phone.length === 11) {
    return `${phone.slice(0, 3)}****${phone.slice(7)}`;
  }
  return "****";
}

export function maskStoredPhone(stored: string | null | undefined): string | null {
  const plain = decryptPhone(stored);
  if (!plain) return null;
  return maskPhone(plain);
}

export function isEncryptedPhone(stored: string | null | undefined): boolean {
  return !!stored && ENCRYPTED_PHONE_PATTERN.test(stored);
}

/** 写入 DB 前的标准形态：密文 + 查重 hash */
export function preparePhoneForStorage(plainPhone: string): {
  phone: string;
  phoneHash: string;
} {
  return {
    phone: encryptPhone(plainPhone),
    phoneHash: hashPhone(plainPhone),
  };
}
