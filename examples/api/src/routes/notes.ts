/** Notes routes: validate with zod, delegate to the repository, answer with the envelope. */
import { Hono } from "hono";
import { z } from "zod";
import { ApiError, ok, rateLimit } from "@kashi/core/server";
import { listQuerySchema } from "@kashi/list/server";
import { NotesRepository } from "../repositories/notes-repository";
import type { AppEnv } from "../types";

const listQuery = listQuerySchema(["updatedAt", "title"], { defaultDirection: "desc" });
const createBody = z.object({ title: z.string().trim().min(1).max(200), body: z.string().max(10_000).default("") });

export const notesRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const query = listQuery.parse(c.req.query());
    return ok(c, await new NotesRepository(c.env.DB).list(query));
  })
  .get("/:id", async (c) => {
    const note = await new NotesRepository(c.env.DB).get(c.req.param("id"));
    if (!note) throw new ApiError(404, "NOT_FOUND", "Note not found.");
    return ok(c, note);
  })
  .post("/", rateLimit({ scope: "notes-create", limit: 60, windowSeconds: 60 }), async (c) => {
    const input = createBody.parse(await c.req.json());
    return ok(c, await new NotesRepository(c.env.DB).create(input), 201);
  });
