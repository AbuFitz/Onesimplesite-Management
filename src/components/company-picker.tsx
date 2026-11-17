"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

type C = { id: string; name: string; ref: string };

/** Pick a company by typing: matches name or reference as you go, and tapping one goes straight to the next step. Better than a 100-line dropdown. */
export function CompanyPicker({ companies, type, addHref }: { companies: C[]; type?: string; addHref: string }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? companies.filter((c) => `${c.name} ${c.ref}`.toLowerCase().includes(t)) : companies).slice(0, 40);
  }, [q, companies]);
  const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  return (
    <div className="cpick">
      <label className="label" htmlFor="cp-q">Which company is this for?</label>
      <div className="relative">
        <Search size={16} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input id="cp-q" type="search" className="field !pl-10" placeholder="Start typing a name or reference" autoComplete="off" autoFocus value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="cpick-list" aria-label="Companies">
        {list.map((c) => (
          <li key={c.id}><Link href={`/tickets/new?business=${c.id}${type ? `&type=${type}` : ""}`}><span aria-hidden>{initials(c.name)}</span><b>{c.name}</b><em>{c.ref}</em></Link></li>
        ))}
        {list.length === 0 && <li className="cpick-none">No company matches “{q}”. <Link href={addHref} className="underline">Add it first</Link>.</li>}
      </ul>
      <p className="cpick-count" aria-live="polite">{q ? `${list.length} shown` : `Showing ${list.length} of ${companies.length}. Type to narrow it down.`}</p>
    </div>
  );
}
