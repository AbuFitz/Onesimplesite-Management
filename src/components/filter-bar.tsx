"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

export type Chip = { label: string; count?: number; href: string; on: boolean };

/** Quick filters: the one choice people change most, as swipeable chips with live counts. Each is a plain link, so it works without scripts and can be shared. */
export function QuickChips({ items, label }: { items: Chip[]; label: string }) {
  return (
    <nav className="qchips" aria-label={label}>
      {items.map((c) => (
        <Link key={c.label} href={c.href} replace scroll={false} className={`qchip ${c.on ? "on" : ""}`} aria-current={c.on ? "true" : undefined}>
          {c.label}{c.count !== undefined && <i>{c.count}</i>}
        </Link>
      ))}
    </nav>
  );
}

/** The rest of the filters sit in one popover behind a "Filters" button that shows how many are set. Fields inside still apply the moment they change. */
export function FilterPanel({ active, children, label = "Filters" }: { active: number; children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", out); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", out); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={ref} className="fpop">
      <button type="button" className={`fbtn ${active ? "set" : ""}`} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        <SlidersHorizontal size={16} aria-hidden /> {label}{active > 0 && <b>{active}</b>}
      </button>
      <div className={`fbody pop ${open ? "open" : ""}`}>{children}</div>
    </div>
  );
}

/** What is switched on, as chips you can remove one by one (the pattern Linear and Plane use). */
export function AppliedChips({ items, clearHref }: { items: { label: string; value: string; href: string }[]; clearHref: string }) {
  if (!items.length) return null;
  return (
    <div className="achips" aria-label="Filters in use">
      {items.map((c) => <Link key={c.label + c.value} href={c.href} replace scroll={false} className="achip" aria-label={`Remove filter ${c.label}: ${c.value}`}><span>{c.label}</span><b>{c.value}</b><X size={13} aria-hidden /></Link>)}
      <Link href={clearHref} replace scroll={false} className="achip-clear">Clear all</Link>
    </div>
  );
}
