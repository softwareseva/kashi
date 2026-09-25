/** Example routes: parse with zod, delegate to the repository, answer with the envelope. */
import { Hono } from "hono";
import { z } from "zod";
import { ApiError, ok, rateLimit } from "@softwareseva/core/server";
import { ExampleRepository } from "../repositories/example-repository";
import type { AppEnv } from "../types";

const createBody = z.object({ title: z.string().trim().min(1).max(200) });

export const exampleRoutes = new Hono<AppEnv>()
  .get("/:id", async (c) => {
    const row = await new ExampleRepository(c.env.DB).get(c.req.param("id"));
    if (!row) throw new ApiError(404, "NOT_FOUND", "Example not found.");
    return ok(c, row);
  })
  .post("/", rateLimit({ scope: "examples-create", limit: 60, windowSeconds: 60 }), async (c) => {
    const input = createBody.parse(await c.req.json());
    return ok(c, await new ExampleRepository(c.env.DB).create(input), 201);
  });
