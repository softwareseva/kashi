/** Opaque, URL-safe cursors for keyset pagination. Invalid cursors never reach SQL. */
import { ApiError } from "@kashi/core/server";

export type CursorMode = "next" | "previous";
export type Cursor = { value: string | number; id: string; mode: CursorMode };

export function encodeCursor(cursor: Cursor): string {
  const bytes = new TextEncoder().encode(JSON.stringify(cursor));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function decodeCursor(value?: string | null): Cursor | null {
  if (!value) return null;
  if (value.length > 500) throw invalid();
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), (ch) => ch.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<Cursor>;
    const valueOk = typeof parsed.value === "string" || typeof parsed.value === "number";
    if (!valueOk || typeof parsed.id !== "string" || (parsed.mode !== "next" && parsed.mode !== "previous")) throw invalid();
    return parsed as Cursor;
  } catch {
    throw invalid();
  }
}

const invalid = () => new ApiError(422, "INVALID_CURSOR", "The pagination cursor is invalid.");
