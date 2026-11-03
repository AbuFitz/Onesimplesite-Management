"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, Building2, User, FileText, ScrollText, FolderKanban, Ticket, MessagesSquare, Plus, Home, CalendarDays, Settings2, LifeBuoy } from "lucide-react";

type Item = { href: string; title: string; sub?: string; kind: string };
type Group = { title: string; kind: string; items: { href: string; title: string; sub: string }[] };
const ICON: Record<string, typeof Search> = { business: Building2, person: User, quote: FileText, agreement: ScrollText, project: FolderKanban, ticket: Ticket, board: MessagesSquare, action: Plus, go: Home };

/** ⌘K (or Ctrl+K, or clicking the search box): jump anywhere, or start something, without leaving the keyboard. */
export function CommandPalette({ actions }: { actions: { href: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); } if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => { if (open) { setQ(""); setGroups([]); setSel(0); setTimeout(() => input.current?.focus(), 20); document.body.style.overflow = "hidden"; } else document.body.style.overflow = ""; return () => { document.body.style.overflow = ""; }; }, [open]);
  useEffect(() => {
    if (q.trim().length < 2) { setGroups([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => { try { const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctl.signal }); if (r.ok) { setGroups((await r.json()).groups); setSel(0); } } catch { /* a newer search replaced this one */ } }, 160);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  const quick: Item[] = useMemo(() => [...actions.map((a) => ({ href: a.href, title: a.label, kind: "action" })), ...[["/", "Today"], ["/tickets", "Tickets"], ["/customers", "Businesses"], ["/projects", "Projects"], ["/calendar", "Calendar"], ["/board", "Team Board"]].map(([href, title]) => ({ href, title: `Go to ${title}`, kind: "go" }))], [actions]);
  const flat: Item[] = q.trim().length < 2 ? quick : groups.flatMap((g) => g.items.map((i) => ({ ...i, kind: g.kind })));
  const go = (href: string) => { setOpen(false); router.push(href); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(flat.length - 1, s + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    if (e.key === "Enter" && flat[sel]) { e.preventDefault(); go(flat[sel].href); }
  };
  let n = -1;
  const row = (i: Item) => { n++; const idx = n; const Icon = ICON[i.kind] ?? Search; return (
    <li key={i.href + i.title}><button type="button" onMouseEnter={() => setSel(idx)} onClick={() => go(i.href)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${sel === idx ? "bg-soft" : ""}`}>
      <span className="grid size-7 shrink-0 place-items-center rounded-md border border-line bg-white"><Icon size={15} aria-hidden /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold">{i.title}</span>{i.sub && <span className="block truncate text-[12.5px] text-muted">{i.sub}</span>}</span>
      {sel === idx && <CornerDownLeft size={14} className="text-muted" aria-hidden />}</button></li>); };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="relative mx-auto hidden h-9 w-full max-w-lg items-center gap-2 rounded-lg border border-line bg-soft px-3 text-left text-sm text-muted hover:border-edge sm:flex" aria-label="Search, or press Command K">
        <Search size={16} aria-hidden /><span className="flex-1">Search businesses, tickets, projects</span><kbd className="rounded border border-line bg-white px-1.5 py-0.5 text-[11px] font-semibold text-muted">⌘K</kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/40 px-3 pt-[10dvh]" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div role="dialog" aria-label="Search" className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_70px_rgba(0,0,0,.28)]">
            <div className="flex items-center gap-2 border-b border-line px-4"><Search size={17} className="text-muted" aria-hidden /><label htmlFor="cmd-q" className="sr-only">Search</label>
              <input id="cmd-q" ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} autoComplete="off" placeholder="Search, or choose something to do" className="h-12 w-full bg-transparent text-[15px] outline-none focus-visible:outline-none placeholder:text-muted" /></div>
            <div className="max-h-[55dvh] overflow-y-auto p-2">
              {q.trim().length < 2 ? <><p className="px-3 pb-1 pt-2 text-xs font-bold text-muted">Quick actions</p><ul>{quick.map(row)}</ul></>
                : groups.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted">No results for “{q}”. Try a reference number or part of a name.</p>
                : groups.map((g) => <div key={g.title}><p className="px-3 pb-1 pt-2 text-xs font-bold text-muted">{g.title}</p><ul>{g.items.map((i) => row({ ...i, kind: g.kind }))}</ul></div>)}
            </div>
            <div className="flex items-center justify-between border-t border-line bg-soft px-4 py-2 text-[12px] text-muted"><span>↑ ↓ to move, Enter to open</span><span>Esc to close</span></div>
          </div>
        </div>
      )}
    </>
  );
}
