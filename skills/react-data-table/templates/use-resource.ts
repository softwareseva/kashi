/** List hook for a kashi keyset endpoint. Keeps the previous page on screen while the next loads. */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toQueryString, type DirectoryQuery, type Page } from "@kashi/list/react";
import { api } from "../lib/api";

export type Note = { id: string; title: string; body: string; updatedAt: string };
export type NoteSort = "updatedAt" | "title";

export const useNotes = (q: DirectoryQuery<NoteSort>) =>
  useQuery({ queryKey: ["notes", "list", q], queryFn: () => api.get<Page<Note>>(`/notes?${toQueryString(q)}`), placeholderData: keepPreviousData });
