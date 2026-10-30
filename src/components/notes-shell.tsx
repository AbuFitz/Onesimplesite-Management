"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { FileText, Lock, Plus, Search } from "lucide-react";
import { newPageAction } from "@/app/actions/notes";
import { timeAgo } from "./ui";

type Item = { id: string; title: string; snippet: string; updatedAt: string; visibility: string };

/** Pages on the left, the open page on the right. On a phone, one at a time. */
export function NotesShell({ items, canWrite, children }: { items: Item[]; canWrite: boolean; children: ReactNode }) {
  const path = usePathname();
  const [q, setQ] = useState("");
  const onIndex = path === "/notes";
  const shown = useMemo(() => { const n = q.trim().toLowerCase(); return n ? items.filter((i) => `${i.title} ${i.snippet}`.toLowerCase().includes(n)) : items; }, [items, q]);
  return (
    <div className="-mx-4 grid min-h-[calc(100dvh-8rem)] lg:mx-0 lg:grid-cols-[17rem_1fr] lg:gap-8">
      <aside aria-label="Pages" className={`${onIndex ? "block" : "hidden"} px-4 lg:block lg:px-0`}>
        <div className="sticky top-20">
          <div className="mb-3 flex items-center justify-between"><h1 className="text-xl">Notes</h1>
            {canWrite && <form action={newPageAction}><button className="btn h-9 gap-1.5 px-3 text-sm"><Plus size={15} aria-hidden />New page</button></form>}</div>
          <div className="relative mb-2"><Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <label htmlFor="ns" className="sr-only">Search pages</label><input id="ns" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages" className="field !pl-9 !text-sm" /></div>
          {shown.length === 0 ? <p className="py-6 text-sm text-muted">{items.length ? "No pages match." : "No pages yet. Make the first one."}</p> : (
            <ul className="max-h-[calc(100dvh-14rem)] overflow-y-auto">
              {shown.map((n) => {
                const active = path === `/notes/${n.id}`;
                return (
                  <li key={n.id}><Link href={`/notes/${n.id}`} aria-current={active ? "page" : undefined} className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-soft ${active ? "bg-soft" : ""}`}>
                    <FileText size={16} aria-hidden className="mt-0.5 shrink-0 text-muted" />
                    <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 truncate text-[15px] font-medium">{n.title}{n.visibility === "private" && <Lock size={12} aria-label="Private" className="shrink-0 text-muted" />}</span>
                      <span className="block truncate text-xs text-muted">{n.snippet || timeAgo(new Date(n.updatedAt))}</span></span>
                  </Link></li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
      <section className={`${onIndex ? "hidden lg:block" : "block"} min-w-0 px-4 lg:px-0`}>
        {!onIndex && <Link href="/notes" className="mb-3 inline-flex min-h-9 items-center text-sm text-muted hover:text-ink lg:hidden">‹ All pages</Link>}
        {children}
      </section>
    </div>
  );
}
