import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "../src/server/cursor";
import { finishPage, keyset } from "../src/server/keyset";
import { listQuerySchema } from "../src/contracts/index";

const rows = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ({ id: `r${from + i}`, name: `n${from + i}` }));

describe("cursor", () => {
  it("round-trips and rejects garbage", () => {
    const c = { value: "n3", id: "r3", mode: "next" as const };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
    expect(() => decodeCursor("!!!")).toThrowError(/cursor/);
    expect(() => decodeCursor(btoa(JSON.stringify({ value: {}, id: 1 })))).toThrowError(/cursor/);
    expect(decodeCursor(undefined)).toBeNull();
  });
});

describe("keyset", () => {
  it("builds forward and backward predicates", () => {
    expect(keyset({ column: "name", direction: "asc" })).toMatchObject({ where: "", bindings: [], orderBy: "name ASC, id ASC" });
    const back = keyset({ column: "name", direction: "asc", cursor: { value: "n5", id: "r5", mode: "previous" } });
    expect(back.where).toBe("(name < ? OR (name = ? AND id < ?))");
    expect(back.bindings).toEqual(["n5", "n5", "r5"]);
    expect(back.orderBy).toBe("name DESC, id DESC");
  });
  it("finishes a first page with next only", () => {
    const page = finishPage(rows(4), 3, null, (r) => r.name);
    expect(page.items.map((r) => r.id)).toEqual(["r0", "r1", "r2"]);
    expect(page.previous).toBeNull();
    expect(decodeCursor(page.next)).toEqual({ value: "n2", id: "r2", mode: "next" });
  });
  it("finishes a backward page in display order", () => {
    // fetched in reversed order because the query flipped direction
    const fetched = [...rows(3, 2)].reverse().concat(rows(1, 1)); // r4,r3,r2 + extra r1
    const page = finishPage(fetched, 3, { value: "n5", id: "r5", mode: "previous" }, (r) => r.name);
    expect(page.items.map((r) => r.id)).toEqual(["r2", "r3", "r4"]);
    expect(decodeCursor(page.previous)?.id).toBe("r2");
    expect(decodeCursor(page.next)?.id).toBe("r4");
  });
});

describe("listQuerySchema", () => {
  it("applies defaults and the sort allowlist", () => {
    const schema = listQuerySchema(["name", "updatedAt"], { defaultSort: "updatedAt", defaultDirection: "desc" });
    expect(schema.parse({})).toEqual({ q: "", sort: "updatedAt", direction: "desc", limit: 25 });
    expect(schema.parse({ q: " x ", limit: "10", sort: "name" })).toMatchObject({ q: "x", limit: 10, sort: "name" });
    expect(schema.safeParse({ sort: "password" }).success).toBe(false);
    expect(schema.safeParse({ limit: "500" }).success).toBe(false);
  });
});
