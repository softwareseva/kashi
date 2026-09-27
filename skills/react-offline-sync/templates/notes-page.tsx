/** Offline-first notes: reads and writes go through the RxDB-backed collection, never the api client directly. */
import { useLiveQuery } from "@tanstack/react-db";
import { Button, useAppForm } from "@softwareseva/ui";
import { notesCollectionDb } from "./sync";

export function NotesPage() {
  const { data: notes, isLoading } = useLiveQuery(notesCollectionDb);
  return (
    <section className="grid gap-4">
      <h1 className="text-title">Notes</h1>
      <NewNote />
      {isLoading ? <p className="text-body-sm text-ink-muted">Loading…</p> : (
        <ul className="grid gap-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-md border border-border p-3">
              <p className="font-medium">{note.title}</p>
              {note.body ? <p className="text-body-sm text-ink-muted">{note.body}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NewNote() {
  const form = useAppForm({
    defaultValues: { title: "" },
    onSubmit: async ({ value, formApi }) => {
      // Writes locally to RxDB and enqueues the `note.upsert` op on SyncEngine; works offline.
      notesCollectionDb.insert({ id: crypto.randomUUID(), title: value.title, body: "", updatedAt: new Date().toISOString() });
      formApi.reset();
    },
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); void form.handleSubmit(); }} className="flex flex-wrap items-end gap-3">
      <form.AppField name="title">{(field) => <field.TextField label="New note" placeholder="Title" />}</form.AppField>
      <Button type="submit">Add</Button>
    </form>
  );
}
