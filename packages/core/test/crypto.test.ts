import { describe, expect, it } from "vitest";
import { base64UrlToBytes, bytesToBase64Url, hmac, randomDigits, randomToken, safeEqual, sha256, sha256Hex } from "../src/server/crypto";

describe("crypto", () => {
  it("round-trips base64url", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(base64UrlToBytes(bytesToBase64Url(bytes))).toEqual(bytes);
    expect(bytesToBase64Url(bytes)).not.toMatch(/[+/=]/);
  });
  it("produces tokens and digits of the right shape", () => {
    expect(randomToken()).toHaveLength(43);
    expect(randomDigits(6)).toMatch(/^\d{6}$/);
  });
  it("hashes deterministically", async () => {
    expect(await sha256("a")).toBe(await sha256("a"));
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(await hmac("a", "k")).not.toBe(await hmac("a", "k2"));
  });
  it("compares safely", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);
  });
});
