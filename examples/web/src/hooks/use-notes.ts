/** Notes resource hooks. Pages use these, never the api client directly. */
import { useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@softwareseva/core/react";
import { createListQuery } from "@softwareseva/list/react";
import { api } from "../lib/api";

export type Note = { id: string; title: string; body: string; createdAt: string; updatedAt: string };
export type NoteSort = "updatedAt" | "title";

export const useNotesQuery = createListQuery<Note, NoteSort>(api, { path: "/notes", queryKey: "notes" });

export function useCreateNote() {
  const qc = useQueryClient();
  return useApiMutation({
    mutationFn: (body: { title: string; body?: string }) => api.post<Note>("/notes", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });
}
