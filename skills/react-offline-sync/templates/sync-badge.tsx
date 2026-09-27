/** Small sync status badge for a header or toolbar. */
import { useSyncStatus } from "@softwareseva/sync/react";
import { Badge } from "@softwareseva/ui";
import { syncEngine } from "./sync";

export function SyncBadge() {
  const status = useSyncStatus(syncEngine);
  const [label, variant] = ((): [string, "neutral" | "success" | "danger"] => {
    if (status.phase === "syncing") return ["Syncing", "neutral"];
    if (status.phase === "offline") return [status.pending > 0 ? `${status.pending} waiting` : "Offline", "neutral"];
    if (status.phase === "failed") return ["Sync failed", "danger"];
    if (status.needsAttention > 0) return [`${status.needsAttention} need attention`, "danger"];
    return [status.pending > 0 ? `${status.pending} waiting` : "Up to date", "success"];
  })();
  return <Badge variant={variant} onClick={() => void syncEngine.sync()} className="cursor-pointer">{label}</Badge>;
}
