---
name: react-data-table
description: Build a directory or admin table screen in React with @softwareseva/list/react, covering the DataTable with sortable headers, skeleton loading, empty state and a card layout on phones, plus search, page size, sort and cursor paging kept in the URL with any router. Use when showing a list of records from a kashi API, adding sort or search to a table, making a table work on mobile, or wiring previous/next cursor pagination.
license: MIT
metadata:
  version: "0.1.0"
  packages: "@softwareseva/list@0.1 @softwareseva/ui@0.1"
---

# Directory screens

The server side is the `d1-list-pagination` skill: the endpoint accepts `q`, `sort`, `direction`, `limit`, `cursor` and answers `{ items, next, previous }`. This skill is the React side. Copy `templates/directory-page.tsx` and `templates/use-resource.ts`, rename, and adjust columns.

## Pieces

- `useDirectory([params, setParams], defaults)` reads and writes list state in the URL. Pass `useSearchParams()` from react-router, or `useUrlSearchParams()` when the app has no router. Every change except paging clears the cursor, so a new search never lands on a stale page.
- `dir.query` goes straight into the API call: `api.get<Page<T>>(\`/notes?${toQueryString(dir.query)}\`)`.
- `DataTable` renders rows. Give every column a `key`, `label`, `render`; mark API-allowlisted keys `sortable`. Pass `sort`, `direction`, `onSort={dir.setSort}`.
- `DirectoryToolbar` gives a debounced search box and a page-size select. Put extra filters in its children and update them with `dir.setFilter(name, value)`.
- `CursorPagination previous={page.previous} next={page.next} onPage={dir.goTo}`.

## Rules

- `defaults.sortKeys` must match the server allowlist. Unknown keys in the URL fall back to the default instead of producing a 422.
- Use TanStack Query with `placeholderData: keepPreviousData` so the table stays visible (dimmed, `aria-busy`) while the next page loads. Pass `loading={query.isFetching}`.
- Give `caption` (screen-reader table name) and a helpful `empty` message that mentions the search term.
- Provide `mobileRow` for tables with more than three columns. Below the `md` breakpoint the table becomes a card list with a "Sort by" control. Without `mobileRow`, mark secondary columns `hideOnMobile`.
- Right-align numbers and dates (`align: "end"`); they render with tabular numerals.
- `onRowClick` navigates to the detail page; keep a real link inside the row as well for keyboard and middle-click users.
- Filters that are not in the URL are lost on reload and cannot be shared; keep them in the URL through `setFilter`.

## Tailwind

Add `@source "../node_modules/@softwareseva/list/dist/react";` to the app CSS or the table renders without styles (see `kashi-ui-web`).
