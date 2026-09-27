/** Directory page: URL-backed search, sort, page size and cursor paging over a kashi list endpoint. */
import { CursorPagination, DataTable, DirectoryToolbar, useUrlSearchParams, type DataColumn } from "@softwareseva/list/react";
import { Alert } from "@softwareseva/ui";
import { useNotesQuery, type Note, type NoteSort } from "../hooks/use-resource";

const defaults = { sort: "updatedAt", direction: "desc", sortKeys: ["updatedAt", "title"] } as const satisfies { sort: NoteSort; direction: "desc"; sortKeys: readonly NoteSort[] };
const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

const columns: DataColumn<Note, NoteSort | "body">[] = [
  { key: "title", label: "Title", sortable: true, render: (n) => <span className="font-medium">{n.title}</span> },
  { key: "body", label: "Body", hideOnMobile: true, render: (n) => <span className="line-clamp-1 text-ink-muted">{n.body}</span> },
  { key: "updatedAt", label: "Updated", sortable: true, align: "end", render: (n) => dateFmt.format(new Date(n.updatedAt)) },
];

export function NotesPage() {
  // Swap useUrlSearchParams() for useSearchParams() from your router if you want the query string owned by the router instead.
  const { dir, query } = useNotesQuery(useUrlSearchParams(), defaults);
  return (
    <section className="grid gap-4">
      <h1 className="text-title">Notes</h1>
      <DirectoryToolbar q={dir.q} onSearch={dir.setSearch} limit={dir.limit} onLimit={dir.setLimit} placeholder="Search notes" />
      {query.error ? <Alert variant="danger" title={query.error.message} /> : null}
      <DataTable
        caption="Notes"
        rows={query.data?.items ?? []}
        columns={columns}
        sort={dir.sort}
        direction={dir.direction}
        onSort={(key) => { if (key !== "body") dir.setSort(key); }}
        loading={query.isFetching}
        empty={dir.q ? `No notes match “${dir.q}”.` : "No notes yet."}
        mobileRow={(n) => <div className="grid gap-1"><span className="font-medium">{n.title}</span><span className="text-body-sm text-ink-muted">{dateFmt.format(new Date(n.updatedAt))}</span></div>}
      />
      <CursorPagination previous={query.data?.previous ?? null} next={query.data?.next ?? null} onPage={dir.goTo} />
    </section>
  );
}
