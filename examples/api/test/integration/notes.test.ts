import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

type Note = { id: string; title: string; updatedAt: string };
type Page = { items: Note[]; next: string | null; previous: string | null };
const api = async <T>(path: string, init?: RequestInit) => {
  const res = await SELF.fetch(`http://example.com/v1${path}`, { headers: { "Content-Type": "application/json" }, ...init });
  return { status: res.status, body: (await res.json()) as { data?: T; code?: string; fields?: Record<string, string[]>; requestId?: string } };
};

describe("notes", () => {
  it("validates input with the envelope", async () => {
    const { status, body } = await api("/notes", { method: "POST", body: JSON.stringify({ title: "" }) });
    expect(status).toBe(422);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.fields?.title).toBeDefined();
    expect(body.requestId).toBeTruthy();
  });

  it("pages forward and backward with search and sort", async () => {
    for (const title of ["alpha", "bravo", "charlie", "delta", "echo"]) {
      expect((await api("/notes", { method: "POST", body: JSON.stringify({ title }) })).status).toBe(201);
    }
    const p1 = (await api<Page>("/notes?sort=title&direction=asc&limit=2")).body.data!;
    expect(p1.items.map((n) => n.title)).toEqual(["alpha", "bravo"]);
    expect(p1.previous).toBeNull();
    const p2 = (await api<Page>(`/notes?sort=title&direction=asc&limit=2&cursor=${p1.next}`)).body.data!;
    expect(p2.items.map((n) => n.title)).toEqual(["charlie", "delta"]);
    const back = (await api<Page>(`/notes?sort=title&direction=asc&limit=2&cursor=${p2.previous}`)).body.data!;
    expect(back.items.map((n) => n.title)).toEqual(["alpha", "bravo"]);
    const p3 = (await api<Page>(`/notes?sort=title&direction=asc&limit=2&cursor=${p2.next}`)).body.data!;
    expect(p3.items.map((n) => n.title)).toEqual(["echo"]);
    expect(p3.next).toBeNull();
    const search = (await api<Page>("/notes?q=%25l%25")).body.data!; // literal "%l%" must not act as a wildcard
    expect(search.items).toHaveLength(0);
    const found = (await api<Page>("/notes?q=lt")).body.data!;
    expect(found.items.map((n) => n.title)).toEqual(["delta"]);
  });

  it("rejects bad cursors and unknown sort keys", async () => {
    expect((await api("/notes?cursor=nope")).body.code).toBe("INVALID_CURSOR");
    expect((await api("/notes?sort=body")).status).toBe(422);
  });

  it("404s through the envelope", async () => {
    const { status, body } = await api("/notes/missing");
    expect(status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
  });
});
