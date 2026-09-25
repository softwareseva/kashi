import { describe, expect, it } from "vitest";
import { syncRouter } from "../src/router";
import { z } from "zod";

describe("syncRouter", () => {
  it("builds a Hono app with push and pull routes", () => {
    const app = syncRouter({ auth: async (_c, next) => next(), user: () => ({ id: "u" }), scopes: () => ["global"], handlers: { "x.op": { schema: z.object({}), apply: () => null } }, entities: {} });
    const routes = app.routes.map((r) => `${r.method} ${r.path}`);
    expect(routes).toContain("POST /push");
    expect(routes).toContain("GET /pull");
  });
});
