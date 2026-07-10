import { describe, expect, it } from "vitest";
import {
  decryptPhone,
  encryptPhone,
  hashPhone,
  isEncryptedPhone,
  maskPhone,
  maskStoredPhone,
  normalizePhone,
  preparePhoneForStorage,
} from "@/lib/phone-crypto";

describe("phone-crypto", () => {
  it("normalizePhone strips non-digits", () => {
    expect(normalizePhone("151 9828-7686")).toBe("15198287686");
  });

  it("encrypt/decrypt round-trip", () => {
    const plain = "15198287686";
    const enc = encryptPhone(plain);
    expect(enc).not.toContain(plain);
    expect(decryptPhone(enc)).toBe(plain);
  });

  it("hashPhone is deterministic", () => {
    expect(hashPhone("15198287686")).toBe(hashPhone("15198287686"));
    expect(hashPhone("15198287686")).not.toBe(hashPhone("13800138000"));
  });

  it("preparePhoneForStorage returns ciphertext + hash", () => {
    const { phone, phoneHash } = preparePhoneForStorage("15198287686");
    expect(isEncryptedPhone(phone)).toBe(true);
    expect(phoneHash).toBe(hashPhone("15198287686"));
    expect(decryptPhone(phone)).toBe("15198287686");
  });

  it("decryptPhone returns legacy plaintext as-is", () => {
    expect(decryptPhone("15198287686")).toBe("15198287686");
  });

  it("maskPhone masks middle digits", () => {
    expect(maskPhone("15198287686")).toBe("151****7686");
  });

  it("maskStoredPhone works on encrypted value", () => {
    const enc = encryptPhone("15198287686");
    expect(maskStoredPhone(enc)).toBe("151****7686");
  });
});
