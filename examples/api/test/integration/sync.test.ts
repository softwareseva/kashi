import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

type Json = { data?: any; code?: string };
const call = async (path: string, init: RequestInit & { json?: unknown; token?: string } = {}) => {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  const res = await SELF.fetch(`http://example.com/v1${path}`, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
  return { status: res.status, body: (await res.json()) as Json };
};
async function signIn(phone: string) {
  await call("/auth/otp/request", { method: "POST", json: { destination: phone } });
  const code = (await env.DB.prepare("SELECT body FROM dev_outbox ORDER BY id DESC LIMIT 1").first<{ body: string }>())!.body;
  return (await call("/auth/otp/verify", { method: "POST", json: { destination: phone, code, transport: "token" } })).body.data.accessToken as string;
}

describe("sync", () => {
  it("requires a session", async () => {
    expect((await call("/sync/pull")).status).toBe(401);
  });

  it("applies an op once and replays it on retry", async () => {
    const token = await signIn("9100000001");
    const ops = [{ opId: "op-aaaaaaaa", type: "note.upsert", payload: { id: "note_local1", title: "Offline note" } }];
    const first = await call("/sync/push", { method: "POST", json: { ops }, token });
    expect(first.body.data.results[0]).toMatchObject({ opId: "op-aaaaaaaa", status: "applied" });
    const again = await call("/sync/push", { method: "POST", json: { ops: [{ ...ops[0], payload: { id: "note_local1", title: "Changed in retry" } }] }, token });
    expect(again.body.data.results[0].status).toBe("replayed");
    const row = await env.DB.prepare("SELECT title FROM notes WHERE id = 'note_local1'").first<{ title: string }>();
    expect(row!.title).toBe("Offline note");
  });

  it("reports unknown ops and invalid payloads as non-retryable failures without stopping the batch", async () => {
    const token = await signIn("9100000002");
    const { body } = await call("/sync/push", { method: "POST", token, json: { ops: [
      { opId: "op-bbbbbbbb", type: "nope", payload: {} },
      { opId: "op-cccccccc", type: "note.upsert", payload: { id: "note_x", title: "" } },
      { opId: "op-dddddddd", type: "note.delete", payload: { id: "missing" } },
      { opId: "op-eeeeeeee", type: "note.upsert", payload: { id: "note_ok1", title: "Fine" } },
    ] } });
    expect(body.data.results.map((r: any) => [r.status, r.error?.code, r.error?.retryable])).toEqual([
      ["failed", "UNKNOWN_OP", false], ["failed", "VALIDATION_ERROR", false], ["failed", "NOT_FOUND", false], ["applied", undefined, undefined],
    ]);
  });

  it("pulls upserts and deletes after a cursor, in pages, including web-created notes", async () => {
    const token = await signIn("9100000003");
    const start = (await call("/sync/pull", { token })).body.data.next as number;
    await call("/notes", { method: "POST", json: { title: "From the web" } });
    await call("/sync/push", { method: "POST", token, json: { ops: [
      { opId: "op-ffffffff", type: "note.upsert", payload: { id: "note_a", title: "A" } },
      { opId: "op-gggggggg", type: "note.upsert", payload: { id: "note_b", title: "B" } },
      { opId: "op-hhhhhhhh", type: "note.delete", payload: { id: "note_a" } },
    ] } });

    const p1 = (await call(`/sync/pull?since=${start}&limit=2`, { token })).body.data;
    expect(p1.hasMore).toBe(true);
    const p2 = (await call(`/sync/pull?since=${p1.next}&limit=2`, { token })).body.data;
    expect(p2.hasMore).toBe(false);
    const upserts = [...p1.changes.notes.upserts, ...p2.changes.notes.upserts].map((n: any) => n.title);
    const deletes = [...p1.changes.notes.deletes, ...p2.changes.notes.deletes];
    expect(upserts).toContain("From the web");
    expect(upserts).toContain("B");
    expect(deletes).toContain("note_a");

    const nothing = (await call(`/sync/pull?since=${p2.next}`, { token })).body.data;
    expect(nothing).toMatchObject({ changes: {}, next: p2.next, hasMore: false, reset: false });
  });
});
