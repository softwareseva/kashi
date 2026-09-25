# Sync protocol

## Push

Request: `{ ops: [{ opId: string(8..64), type: string, payload: any, clientTs?: number }] }`, 1 to 100 ops.

Per op:

1. If `(user, opId)` exists in `sync_ops`, answer `{ status: "replayed", result }` without running anything.
2. Unknown `type`: `{ status: "failed", error: { code: "UNKNOWN_OP", retryable: false } }`.
3. Payload fails the handler's zod schema: `VALIDATION_ERROR`, not retryable.
4. Handler runs; its statements, the change entries, and the `sync_ops` row commit in one `db.batch`.
5. Handler throws `ApiError`: `retryable` is true for 429 and 5xx only. Anything else is logged and returned as retryable `INTERNAL_ERROR`.

A failing op never stops the rest of the batch. Results come back in request order.

## Pull

`GET /pull?since=<seq>&limit=<1..1000>` (default 500).

- Reads `sync_changes` rows with `scope IN (user scopes) AND seq > since`, ordered by `seq`, `limit + 1` to know `hasMore`.
- Within the page the latest op per `(entity, id)` wins. Upsert ids are loaded through the entity loader in chunks of 90 (D1's 100-parameter limit); ids the loader does not return become deletes.
- `next` is the last `seq` in the page; the client stores it after applying the page in one local transaction.
- `reset: true` when `since` is older than the oldest retained change. The client clears synced tables and starts from 0.

## Why a change log instead of `updated_at`

Timestamps collide and depend on clocks; paging by `updated_at` needs a rewind that resends rows. `seq` is an `AUTOINCREMENT` assigned in commit order (D1 serialises writes per database), so `seq > since` is exact and gap-free.

## Client obligations (kashi_sync does these)

- Generate `opId` once per intent and keep it until the server answers.
- Push before pull. Skip pulled rows whose ids still have pending ops, so unsent local edits are not overwritten.
- Wipe local synced data and the cursor on sign-out.
