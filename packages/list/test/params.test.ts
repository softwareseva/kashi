import { describe, expect, it } from "vitest";
import { readDirectory, toQueryString, withCursor, withLimit, withSearch, withSort } from "../src/react/params";

const d = { sort: "updatedAt" as const, direction: "desc" as const, sortKeys: ["updatedAt", "title"] as const };
const p = (s: string) => new URLSearchParams(s);

describe("directory params", () => {
  it("reads defaults and rejects unknown sort keys and limits", () => {
    expect(readDirectory(p(""), d)).toEqual({ q: "", sort: "updatedAt", direction: "desc", limit: 25 });
    expect(readDirectory(p("sort=password&limit=9999"), d)).toMatchObject({ sort: "updatedAt", limit: 25 });
    expect(readDirectory(p("q=x&sort=title&direction=asc&limit=50&cursor=c1"), d)).toEqual({ q: "x", sort: "title", direction: "asc", limit: 50, cursor: "c1" });
  });
  it("flips direction on the active column and clears the cursor on every change but paging", () => {
    const start = p("sort=title&direction=asc&cursor=c1&q=a");
    expect(withSort(start, "title", d).toString()).toBe("sort=title&direction=desc&q=a");
    expect(withSort(start, "updatedAt", d).get("direction")).toBe("asc");
    expect(withSearch(start, "  b ").toString()).toBe("sort=title&direction=asc&q=b");
    expect(withSearch(start, "").has("q")).toBe(false);
    expect(withLimit(start, 50).has("cursor")).toBe(false);
    expect(withCursor(start, "c2").get("cursor")).toBe("c2");
    expect(withCursor(start, null).has("cursor")).toBe(false);
  });
  it("builds API query strings without empty values", () => {
    expect(toQueryString({ q: "", sort: "title", limit: 25, cursor: undefined })).toBe("sort=title&limit=25");
  });
});
