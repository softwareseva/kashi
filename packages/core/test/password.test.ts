import { describe, expect, it } from "vitest";
import { PBKDF2_ITERATIONS, hashPassword, passwordProblem, verifyPassword } from "../src/server/password";

describe("password", () => {
  it("hashes and verifies", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(stored.startsWith(`pbkdf2$sha256$${PBKDF2_ITERATIONS}$`)).toBe(true);
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });
  it("rejects malformed and over-limit records", async () => {
    expect(await verifyPassword("x", "nope")).toBe(false);
    expect(await verifyPassword("x", "pbkdf2$sha256$5000000$AA$AA")).toBe(false);
  });
  it("applies the policy", () => {
    expect(passwordProblem("short")).toMatch(/at least 12/);
    expect(passwordProblem("long enough password")).toBeNull();
  });
});
