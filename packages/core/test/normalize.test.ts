import { describe, expect, it } from "vitest";
import { likeAny, likePattern } from "../src/server/like";
import { normalizeEmail, normalizePhone } from "../src/server/phone";
import { newId } from "../src/server/ids";

describe("normalize", () => {
  it("normalizes phones to E.164 with a default country", () => {
    expect(normalizePhone("98765 43210")).toBe("+919876543210");
    expect(normalizePhone("+1 415 555 2671", { mobileOnly: true })).toBe("+14155552671");
    expect(normalizePhone("12", {})).toBeNull();
  });
  it("normalizes emails", () => {
    expect(normalizeEmail("  Foo@Example.COM ")).toBe("foo@example.com");
    expect(normalizeEmail("nope")).toBeNull();
  });
  it("escapes LIKE wildcards", () => {
    expect(likePattern("50%_off")).toBe("%50\\%\\_off%");
    expect(likeAny(["name", "email"])).toBe("(name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')");
  });
  it("makes sortable ids", () => {
    const a = newId("usr"); const b = newId("usr");
    expect(a).toMatch(/^usr_[0-9a-z]{9}[0-9a-f]{12}$/);
    expect(a <= b).toBe(true);
  });
});
