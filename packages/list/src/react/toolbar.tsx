/** Search box (debounced), page-size select and previous/next cursor buttons for directory screens. */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn } from "@kashi/ui";

export function DirectoryToolbar({ q, onSearch, limit, onLimit, placeholder = "Search", limits = [10, 25, 50, 100], debounceMs = 300, children, className }: {
  q: string;
  onSearch: (q: string) => void;
  limit?: number;
  onLimit?: (limit: number) => void;
  placeholder?: string;
  limits?: number[];
  debounceMs?: number;
  /** Extra filters or actions, rendered at the end of the row. */
  children?: ReactNode;
  className?: string;
}) {
  const id = useId();
  const [value, setValue] = useState(q);
  const last = useRef(q);
  useEffect(() => { if (q !== last.current) { setValue(q); last.current = q; } }, [q]);
  useEffect(() => {
    if (value.trim() === last.current.trim()) return;
    const t = setTimeout(() => { last.current = value; onSearch(value); }, debounceMs);
    return () => clearTimeout(t);
  }, [value, debounceMs, onSearch]);

  return (
    <div role="search" className={cn("flex flex-wrap items-end gap-3", className)}>
      <label htmlFor={`${id}-q`} className="grid min-w-56 flex-1 gap-2 text-label text-ink">
        Search
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <Input id={`${id}-q`} type="search" value={value} placeholder={placeholder} className="pl-9" onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { last.current = value; onSearch(value); } }} />
        </div>
      </label>
      {onLimit && limit !== undefined ? (
        <label className="grid gap-2 text-label text-ink">
          Rows
          <Select value={String(limit)} onValueChange={(v) => onLimit(Number(v))}>
            <SelectTrigger className="w-24" aria-label="Rows per page"><SelectValue /></SelectTrigger>
            <SelectContent>{limits.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
          </Select>
        </label>
      ) : null}
      {children}
    </div>
  );
}

export function CursorPagination({ previous, next, onPage, className }: { previous: string | null; next: string | null; onPage: (cursor: string | null) => void; className?: string }) {
  if (!previous && !next) return null;
  return (
    <nav aria-label="Pages" className={cn("flex justify-end gap-2", className)}>
      <Button variant="outline" size="sm" disabled={!previous} onClick={() => onPage(previous)}><ChevronLeft aria-hidden />Previous</Button>
      <Button variant="outline" size="sm" disabled={!next} onClick={() => onPage(next)}>Next<ChevronRight aria-hidden /></Button>
    </nav>
  );
}
