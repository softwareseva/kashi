/** GET /v1/notes?q=&sort=&direction=&limit=&cursor= */
import { Hono } from "hono";
import { ok } from "@softwareseva/core/server";
import { listQuerySchema } from "@softwareseva/list/server";
import { NotesRepository } from "../repositories/notes-repository";
import type { AppEnv } from "../types";

const listQuery = listQuerySchema(["updatedAt", "title"], { defaultDirection: "desc" });

export const notesRoutes = new Hono<AppEnv>().get("/", async (c) => {
  const query = listQuery.parse(c.req.query());
  return ok(c, await new NotesRepository(c.env.DB).list(query));
});
