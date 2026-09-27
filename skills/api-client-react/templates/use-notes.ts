/** Hooks for the notes resource: keys, list, detail, create. Pages use these, never the api client directly. */
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { useApiQuery, useApiMutation } from "@softwareseva/core/react";
import type { Page } from "@softwareseva/list/contracts";
import { api } from "../lib/api";

export type Note = { id: string; title: string; body: string; updatedAt: string };
export type NoteListParams = { q?: string; sort?: "updatedAt" | "title"; direction?: "asc" | "desc"; limit?: number; cursor?: string };

const toSearch = (p: Record<string, string | number | undefined>) => new URLSearchParams(Object.entries(p).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();

export const noteKeys = {
  all: ["notes"] as const,
  list: (p: NoteListParams) => [...noteKeys.all, "list", p] as const,
  one: (id: string) => [...noteKeys.all, "one", id] as const,
};

export const useNotes = (p: NoteListParams) => useApiQuery({ queryKey: noteKeys.list(p), queryFn: () => api.get<Page<Note>>(`/notes?${toSearch(p)}`), placeholderData: keepPreviousData });
export const useNote = (id: string) => useApiQuery({ queryKey: noteKeys.one(id), queryFn: () => api.get<Note>(`/notes/${id}`) });
export function useCreateNote() {
  const qc = useQueryClient();
  return useApiMutation({ mutationFn: (body: { title: string; body?: string }) => api.post<Note>("/notes", body), onSuccess: () => qc.invalidateQueries({ queryKey: noteKeys.all }) });
}
