import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("examples", () => {
  it("creates and reads through the envelope", async () => {
    const created = await SELF.fetch("http://example.com/v1/examples", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "hello" }) });
    expect(created.status).toBe(201);
    const { data } = (await created.json()) as { data: { id: string } };
    const read = await SELF.fetch(`http://example.com/v1/examples/${data.id}`);
    expect(((await read.json()) as { data: { title: string } }).data.title).toBe("hello");
  });
  it("returns 422 with fields on invalid input", async () => {
    const res = await SELF.fetch("http://example.com/v1/examples", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { code: string }).code).toBe("VALIDATION_ERROR");
  });
});
