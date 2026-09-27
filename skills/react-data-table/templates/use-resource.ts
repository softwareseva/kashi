/** List hook for a kashi keyset endpoint, built with createListQuery: URL state (useDirectory) plus a keepPreviousData fetch in one call. */
import { createListQuery } from "@softwareseva/list/react";
import { api } from "../lib/api";

export type Note = { id: string; title: string; body: string; updatedAt: string };
export type NoteSort = "updatedAt" | "title";

export const useNotesQuery = createListQuery<Note, NoteSort>(api, { path: "/notes", queryKey: "notes" });
