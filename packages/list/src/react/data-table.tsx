/** Accessible, token-styled data table with sortable headers, loading and empty states, and an optional card layout on small screens. */
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Button, cn } from "@kashi/ui";

export type DataColumn<T, K extends string = string> = {
  key: K;
  label: string;
  /** Must be one of the API's allowlisted sort keys. */
  sortable?: boolean;
  align?: "start" | "end";
  className?: string;
  /** Hide on narrow screens when no `mobileRow` is given. */
  hideOnMobile?: boolean;
  render: (row: T) => ReactNode;
};

export type DataTableProps<T extends { id: string }, K extends string> = {
  rows: T[];
  columns: DataColumn<T, K>[];
  sort?: string;
  direction?: "asc" | "desc";
  onSort?: (key: K) => void;
  /** Shows skeleton rows (first load) or dims rows (refetch) and sets aria-busy. */
  loading?: boolean;
  empty?: ReactNode;
  /** Accessible table name, e.g. "Notes". */
  caption: string;
  onRowClick?: (row: T) => void;
  /** Card layout for screens below `md`; the table is used above it. */
  mobileRow?: (row: T) => ReactNode;
  className?: string;
};

export function DataTable<T extends { id: string }, K extends string = string>({ rows, columns, sort, direction = "asc", onSort, loading, empty = "Nothing here yet.", caption, onRowClick, mobileRow, className }: DataTableProps<T, K>) {
  const firstLoad = loading && rows.length === 0;
  return (
    <div className={cn("rounded-lg border border-border bg-surface-raised", className)} aria-busy={loading || undefined}>
      {mobileRow && onSort && columns.some((c) => c.sortable) ? (
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2 md:hidden">
          <label className="flex items-center gap-2 text-label text-ink-muted">
            Sort by
            <select className="h-9 rounded-md border border-input bg-surface-raised px-2 text-body-sm text-ink" value={sort} onChange={(e) => onSort(e.target.value as K)}>
              {columns.filter((c) => c.sortable).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </label>
          {sort ? (
            <Button variant="ghost" size="sm" onClick={() => onSort(sort as K)} aria-label={direction === "asc" ? "Sorted ascending, switch to descending" : "Sorted descending, switch to ascending"}>
              {direction === "asc" ? <ArrowUp aria-hidden /> : <ArrowDown aria-hidden />}{direction === "asc" ? "Ascending" : "Descending"}
            </Button>
          ) : null}
        </div>
      ) : null}
      {mobileRow ? (
        <ul className="divide-y divide-border md:hidden" aria-label={caption}>
          {firstLoad ? skeleton(3).map((i) => <li key={i} className="h-16 animate-pulse bg-surface" />) : rows.length ? rows.map((row) => (
            <li key={row.id} className={cn("p-4", onRowClick && "cursor-pointer active:bg-saffron-soft")} onClick={onRowClick ? () => onRowClick(row) : undefined}>{mobileRow(row)}</li>
          )) : <li className="px-4 py-12 text-center text-body-sm text-ink-muted">{empty}</li>}
        </ul>
      ) : null}
      <div className={cn("overflow-x-auto", mobileRow && "hidden md:block")}>
        <table className={cn("w-full border-collapse text-left text-body-sm transition-opacity", loading && !firstLoad && "opacity-60")}>
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface text-label text-ink-muted">
            <tr>
              {columns.map((col) => (
                <th key={col.key} scope="col" className={cn("px-4 py-3 font-medium", col.align === "end" && "text-right", col.hideOnMobile && !mobileRow && "hidden md:table-cell", col.className)} aria-sort={sort === col.key ? (direction === "asc" ? "ascending" : "descending") : undefined}>
                  {col.sortable && onSort ? (
                    <Button variant="ghost" size="sm" className={cn("-mx-3 text-ink-muted hover:text-ink", sort === col.key && "text-ink")} onClick={() => onSort(col.key)}>
                      {col.label}
                      {sort === col.key ? (direction === "asc" ? <ArrowUp aria-hidden /> : <ArrowDown aria-hidden />) : <ChevronsUpDown aria-hidden className="opacity-50" />}
                    </Button>
                  ) : col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {firstLoad ? skeleton(5).map((i) => (
              <tr key={i} className="border-t border-border">{columns.map((col) => <td key={col.key} className="px-4 py-3"><div className="h-4 w-3/4 animate-pulse rounded-sm bg-surface" /></td>)}</tr>
            )) : rows.length ? rows.map((row) => (
              <tr key={row.id} className={cn("border-t border-border hover:bg-surface", onRowClick && "cursor-pointer")} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                {columns.map((col) => <td key={col.key} className={cn("px-4 py-3 text-ink", col.align === "end" && "text-right tabular-nums", col.hideOnMobile && !mobileRow && "hidden md:table-cell", col.className)}>{col.render(row)}</td>)}
              </tr>
            )) : (
              <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-ink-muted">{empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const skeleton = (n: number) => Array.from({ length: n }, (_, i) => i);
