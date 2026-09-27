/** Local-first notes: read and write through RxDB via a TanStack DB collection; SyncEngine pushes/pulls in the background. */
import { useLiveQuery } from "@tanstack/react-db";
import { useSyncStatus } from "@softwareseva/sync/react";
import { Badge, Button, useAppForm } from "@softwareseva/ui";
import { offlineNotes, offlineSyncEngine } from "../lib/offline-sync";

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function statusBadge(status: ReturnType<typeof useSyncStatus>): { label: string; variant: "neutral" | "success" | "danger" } {
  if (status.phase === "syncing") return { label: "Syncing", variant: "neutral" };
  if (status.phase === "offline") return { label: status.pending > 0 ? `${status.pending} waiting` : "Offline", variant: "neutral" };
  if (status.phase === "failed") return { label: "Sync failed", variant: "danger" };
  if (status.needsAttention > 0) return { label: `${status.needsAttention} need attention`, variant: "danger" };
  return { label: status.pending > 0 ? `${status.pending} waiting` : "Up to date", variant: "success" };
}

export function OfflineNotesPage() {
  const { data: notes, isLoading } = useLiveQuery(offlineNotes);
  const status = useSyncStatus(offlineSyncEngine);
  const { label, variant } = statusBadge(status);
  const form = useAppForm({
    defaultValues: { title: "" },
    onSubmit: async ({ value, formApi }) => {
      offlineNotes.insert({ id: crypto.randomUUID(), title: value.title, body: "", updatedAt: new Date().toISOString() });
      formApi.reset();
    },
  });
  const sorted = [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-title">Offline notes</h1>
        <Badge variant={variant} onClick={() => void offlineSyncEngine.sync()} className="cursor-pointer">{label}</Badge>
      </div>
      <p className="text-body-sm text-ink-muted">Saves to this device immediately, even offline, and syncs to the same notes the directory page shows.</p>
      <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); void form.handleSubmit(); }} className="flex flex-wrap items-end gap-3">
        <form.AppField name="title">{(field) => <field.TextField label="New note" placeholder="Title" />}</form.AppField>
        <Button type="submit">Add</Button>
      </form>
      {isLoading ? <p className="text-body-sm text-ink-muted">Loading…</p> : sorted.length === 0 ? (
        <p className="text-body-sm text-ink-muted">No notes yet.</p>
      ) : (
        <ul className="grid gap-2">
          {sorted.map((note) => (
            <li key={note.id} className="rounded-md border border-border p-3">
              <p className="font-medium">{note.title}</p>
              <p className="text-body-sm text-ink-muted">{dateFmt.format(new Date(note.updatedAt))}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
