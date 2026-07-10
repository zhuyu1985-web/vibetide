import { encrypt, decrypt } from "@/lib/crypto";

export function encryptHeaders(headers: Record<string, string>): string {
  return encrypt(JSON.stringify(headers));
}

export function decryptHeaders(enc: string | null): Record<string, string> {
  if (!enc) return {};
  try {
    return JSON.parse(decrypt(enc));
  } catch {
    return {};
  }
}
