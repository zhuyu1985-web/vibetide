import { test, expect } from "vitest";
import { encryptHeaders, decryptHeaders } from "../crypto-headers";

test("headers round-trip", () => {
  const h = { Authorization: "Bearer xyz" };
  const enc = encryptHeaders(h);
  expect(enc).not.toContain("xyz");
  expect(decryptHeaders(enc)).toEqual(h);
});

test("decrypt null/empty → {}", () => {
  expect(decryptHeaders(null)).toEqual({});
});
