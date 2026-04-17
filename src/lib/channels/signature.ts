import crypto from "crypto";

/**
 * Verify DingTalk outgoing webhook signature.
 * See: https://open.dingtalk.com/document/robots/receive-message
 */
export function verifyDingtalkSignature(
  timestamp: string,
  sign: string,
  secret: string
): boolean {
  try {
    const stringToSign = `${timestamp}\n${secret}`;
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(stringToSign, "utf-8");
    const computed = encodeURIComponent(hmac.digest("base64"));
    // Prevent timing attacks with constant-time comparison
    if (computed.length !== sign.length) return false;
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(sign));
  } catch {
    return false;
  }
}

/**
 * Also verify timestamp is within 1 hour (DingTalk requirement).
 */
export function isDingtalkTimestampValid(timestamp: string): boolean {
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;
  const now = Date.now();
  return Math.abs(now - ts) < 3600 * 1000;
}

/**
 * Verify WeChat Work message signature.
 * msg_signature = SHA1(sort([token, timestamp, nonce, encrypt]).join(""))
 */
export function verifyWechatSignature(
  token: string,
  timestamp: string,
  nonce: string,
  msgEncrypt: string,
  signature: string
): boolean {
  try {
    const arr = [token, timestamp, nonce, msgEncrypt].sort();
    const hash = crypto.createHash("sha1");
    hash.update(arr.join(""));
    const computed = hash.digest("hex");
    if (computed.length !== signature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Decrypt WeChat Work AES-encrypted message.
 *
 * Format after decrypt: [random(16)] + [msg_len(4, big-endian)] + [msg] + [receiveid]
 *
 * @param msgEncrypt Base64-encoded encrypted message
 * @param encodingAesKey Base64-like 43-char key from WeChat admin
 * @returns { content, receiveId } — content is the plaintext, receiveId is the CorpID
 */
export function decryptWechatMessage(
  msgEncrypt: string,
  encodingAesKey: string
): { content: string; receiveId: string } {
  // EncodingAESKey is 43 chars; append "=" for proper base64 padding → 32 bytes
  const aesKey = Buffer.from(encodingAesKey + "=", "base64");
  if (aesKey.length !== 32) {
    throw new Error("Invalid encodingAesKey length");
  }
  const iv = aesKey.subarray(0, 16);
  const encrypted = Buffer.from(msgEncrypt, "base64");

  const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
  decipher.setAutoPadding(false);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  // Remove PKCS7 padding manually
  const padLen = decrypted[decrypted.length - 1];
  const unpadded = decrypted.subarray(0, decrypted.length - padLen);

  // Skip first 16 bytes (random)
  // Next 4 bytes are msg length (big-endian)
  const msgLen = unpadded.readUInt32BE(16);
  const content = unpadded.subarray(20, 20 + msgLen).toString("utf-8");
  const receiveId = unpadded.subarray(20 + msgLen).toString("utf-8");

  return { content, receiveId };
}

/**
 * Encrypt reply message for WeChat Work.
 * Inverse of decryptWechatMessage.
 *
 * @returns base64-encoded encrypted message + signature
 */
export function encryptWechatMessage(
  content: string,
  token: string,
  encodingAesKey: string,
  receiveId: string,
  timestamp: string,
  nonce: string
): { encrypt: string; signature: string } {
  const aesKey = Buffer.from(encodingAesKey + "=", "base64");
  const iv = aesKey.subarray(0, 16);

  const random = crypto.randomBytes(16);
  const contentBuf = Buffer.from(content, "utf-8");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(contentBuf.length, 0);
  const receiveIdBuf = Buffer.from(receiveId, "utf-8");

  const combined = Buffer.concat([random, lenBuf, contentBuf, receiveIdBuf]);

  // PKCS7 padding to 32-byte block
  const blockSize = 32;
  const padLen = blockSize - (combined.length % blockSize);
  const padding = Buffer.alloc(padLen, padLen);
  const padded = Buffer.concat([combined, padding]);

  const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
  cipher.setAutoPadding(false);
  const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]);
  const encryptBase64 = encrypted.toString("base64");

  // Compute signature for the encrypted message
  const arr = [token, timestamp, nonce, encryptBase64].sort();
  const hash = crypto.createHash("sha1");
  hash.update(arr.join(""));
  const signature = hash.digest("hex");

  return { encrypt: encryptBase64, signature };
}
