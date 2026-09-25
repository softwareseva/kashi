# @softwareseva/list

Server-side lists on Cloudflare D1 with search, sort and paging that stay fast at any table size.

- `@softwareseva/list/server`: `listKeyset()` runs a two-way keyset query (`(sort_value, id)` cursors, allowlisted sort columns); `keyset()` + `finishPage()` when you compose the SQL yourself; `listOffset()` for small admin lists that need a total.
- `@softwareseva/list/contracts`: `listQuerySchema(sortKeys)` (zod) and the `Page<T>` / `OffsetPage<T>` shapes for clients.
- `@softwareseva/list/react`: `DataTable` (sortable headers, skeleton loading, empty state, card layout on phones), `useDirectory()` keeping `q/sort/direction/limit/cursor` in the URL with any router, `DirectoryToolbar`, `CursorPagination`. Add `@source "../node_modules/@softwareseva/list/dist/react";` to your CSS.

```ts
const query = listQuerySchema(["title", "updatedAt"], { defaultSort: "updatedAt", defaultDirection: "desc" }).parse(c.req.query());
const page = await listKeyset<NoteRow, "title" | "updatedAt">({
  db: c.env.DB,
  sql: `SELECT id, title, updated_at AS updatedAt FROM notes WHERE ${likeAny(["title"])}`,
  bindings: [likePattern(query.q)],
  sortColumns: { title: "title", updatedAt: "updated_at" },
  ...query,
});
return ok(c, page);
```

Add a composite index per sort key: `CREATE INDEX notes_updated_at_id ON notes(updated_at, id)`. See the `d1-list-pagination` skill.
