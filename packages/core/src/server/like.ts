/** LIKE-pattern escaping so user input cannot inject `%` or `_` wildcards. */
export const LIKE_ESCAPE = "\\";

/** `%needle%` with `%`, `_` and the escape char escaped. Pair with `likeClause()`. */
export function likePattern(needle: string, mode: "contains" | "prefix" = "contains"): string {
  const escaped = needle.replace(/[\\%_]/g, (ch) => LIKE_ESCAPE + ch);
  return mode === "prefix" ? `${escaped}%` : `%${escaped}%`;
}

/** `column LIKE ? ESCAPE '\'` for use inside a WHERE clause. */
export function likeClause(column: string): string {
  return `${column} LIKE ? ESCAPE '${LIKE_ESCAPE}'`;
}

/** `(a LIKE ? ESCAPE '\' OR b LIKE ? ESCAPE '\')`; bind the same pattern once per column. */
export function likeAny(columns: string[]): string {
  return `(${columns.map(likeClause).join(" OR ")})`;
}
