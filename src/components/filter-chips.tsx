import Link from "next/link";

export type Chip = { href: string; label: string; count?: number; active: boolean };

/** A row of filters with counts. On a phone it scrolls sideways instead of wrapping, so the list stays near the top. */
export function FilterChips({ label, items, size = "md" }: { label: string; items: Chip[]; size?: "md" | "sm" }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
      <ul className="flex w-max min-w-full gap-1.5 sm:w-auto sm:flex-wrap">
        {items.map((c) => (
          <li key={c.label} className="shrink-0">
            <Link href={c.href} aria-current={c.active ? "page" : undefined} scroll={false}
              className={`inline-flex items-center gap-2 rounded-lg border font-semibold ${size === "sm" ? "min-h-9 px-2.5 text-[13px]" : "min-h-10 px-3 text-sm"} ${c.active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:bg-bone"}`}>
              {c.label}
              {c.count !== undefined && <span className={`rounded-md px-1.5 text-xs tabular-nums ${c.active ? "bg-white/20 text-white" : "bg-bone text-muted"}`}>{c.count}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
