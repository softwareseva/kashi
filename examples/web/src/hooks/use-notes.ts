/** Notes resource hooks. Pages use these, never the api client directly. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toQueryString, type DirectoryQuery, type Page } from "@softwareseva/list/react";
import { api } from "../lib/api";

export type Note = { id: string; title: string; body: string; createdAt: string; updatedAt: string };
export type NoteSort = "updatedAt" | "title";

export const noteKeys = { all: ["notes"] as const, list: (q: DirectoryQuery<NoteSort>) => [...noteKeys.all, "list", q] as const };

export const useNotes = (q: DirectoryQuery<NoteSort>) =>
  useQuery({ queryKey: noteKeys.list(q), queryFn: () => api.get<Page<Note>>(`/notes?${toQueryString(q)}`), placeholderData: keepPreviousData });

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: { title: string; body?: string }) => api.post<Note>("/notes", body), onSuccess: () => qc.invalidateQueries({ queryKey: noteKeys.all }) });
}
