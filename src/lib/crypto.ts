import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ENCRYPTION_KEY =
  process.env.PLUGIN_ENCRYPTION_KEY || "default-32-byte-key-for-dev-000";
const ALGORITHM = "aes-256-cbc";

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, "utf8").subarray(0, 32),
    iv
  );
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, encrypted] = encryptedText.split(":");
  if (!ivHex || !encrypted) return encryptedText; // 未加密的旧数据兼容
  try {
    const iv = Buffer.from(ivHex, "hex");
    const decipher = createDecipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, "utf8").subarray(0, 32),
      iv
    );
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return encryptedText; // 解密失败返回原文（旧数据兼容）
  }
}
