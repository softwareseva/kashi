/** Notes directory: search, sort, page size and cursor paging, all kept in the URL. */
import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { CursorPagination, DataTable, DirectoryToolbar, useDirectory, type DataColumn } from "@kashi/list/react";
import { Alert, Button, Field, Input } from "@kashi/ui";
import { useCreateNote, useNotes, type Note, type NoteSort } from "../hooks/use-notes";

const defaults = { sort: "updatedAt", direction: "desc", sortKeys: ["updatedAt", "title"] } as const satisfies { sort: NoteSort; direction: "desc"; sortKeys: readonly NoteSort[] };
const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

const columns: DataColumn<Note, NoteSort | "body">[] = [
  { key: "title", label: "Title", sortable: true, render: (n) => <span className="font-medium">{n.title}</span> },
  { key: "body", label: "Body", hideOnMobile: true, render: (n) => <span className="line-clamp-1 text-ink-muted">{n.body || "—"}</span> },
  { key: "updatedAt", label: "Updated", sortable: true, align: "end", render: (n) => dateFmt.format(new Date(n.updatedAt)) },
];

export function NotesPage() {
  const dir = useDirectory(useSearchParams(), defaults);
  const notes = useNotes(dir.query);
  return (
    <section className="grid gap-4">
      <h1 className="text-title">Notes</h1>
      <NewNote />
      <DirectoryToolbar q={dir.q} onSearch={dir.setSearch} limit={dir.limit} onLimit={dir.setLimit} placeholder="Search title or body" />
      {notes.error ? <Alert variant="danger" title={notes.error.message} /> : null}
      <DataTable
        caption="Notes"
        rows={notes.data?.items ?? []}
        columns={columns}
        sort={dir.sort}
        direction={dir.direction}
        onSort={(key) => { if (key !== "body") dir.setSort(key); }}
        loading={notes.isFetching}
        empty={dir.q ? `No notes match “${dir.q}”.` : "No notes yet."}
        mobileRow={(n) => <div className="grid gap-1"><span className="font-medium">{n.title}</span><span className="text-body-sm text-ink-muted">{dateFmt.format(new Date(n.updatedAt))}</span></div>}
      />
      <CursorPagination previous={notes.data?.previous ?? null} next={notes.data?.next ?? null} onPage={dir.goTo} />
    </section>
  );
}

function NewNote() {
  const create = useCreateNote();
  const [title, setTitle] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    await create.mutateAsync({ title }).then(() => setTitle("")).catch(() => undefined);
  }
  const fieldError = (create.error as { fields?: Record<string, string[]> } | null)?.fields?.title?.[0];
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <Field id="new-title" label="New note" error={fieldError}><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" /></Field>
      <Button type="submit" disabled={create.isPending}>Add</Button>
    </form>
  );
}
