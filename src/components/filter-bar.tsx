"use client";
import Link from "next/link";
import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";

export type Chip = { label: string; count?: number; href: string; on: boolean };

/** Quick filters: the one choice people change most, as swipeable chips with live counts. Each is a plain link, so it works without scripts and can be shared. */
export function QuickChips({ items, label }: { items: Chip[]; label: string }) {
  return (
    <nav className="qchips lg:hidden" aria-label={label}>
      {items.map((c) => (
        <Link key={c.label} href={c.href} replace scroll={false} className={`qchip ${c.on ? "on" : ""}`} aria-current={c.on ? "true" : undefined}>
          {c.label}{c.count !== undefined && <i>{c.count}</i>}
        </Link>
      ))}
    </nav>
  );
}

/** The rest of the filters. On a phone they sit behind a "Filters" button that shows how many are set; on a desktop they are always visible. */
export function FilterPanel({ active, children }: { active: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`fbtn lg:hidden ${active ? "set" : ""}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <SlidersHorizontal size={16} aria-hidden /> Filters{active > 0 && <b>{active}</b>}
      </button>
      <div className={`fbody ${open ? "open" : ""}`}>{children}</div>
    </>
  );
}
