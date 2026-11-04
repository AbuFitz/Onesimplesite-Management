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

  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.current?.focus(); input.current?.select(); } };
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", key); document.addEventListener("mousedown", away);
    return () => { window.removeEventListener("keydown", key); document.removeEventListener("mousedown", away); };
  }, []);
  useEffect(() => {
    if (q.trim().length < 2) { setGroups([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => { try { const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctl.signal }); if (r.ok) { setGroups((await r.json()).groups); setSel(0); } } catch { /* a newer search replaced this one */ } }, 160);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  const quick: Item[] = useMemo(() => [...actions.map((a) => ({ href: a.href, title: a.label, kind: "action" })), ...[["/", "Today"], ["/agreements", "Agreements"], ["/tickets", "Tickets"], ["/customers", "Companies"], ["/projects", "Projects"], ["/calendar", "Calendar"], ["/board", "Team Board"]].map(([href, title]) => ({ href, title: `Go to ${title}`, kind: "go" }))], [actions]);
  const flat: Item[] = q.trim().length < 2 ? quick : groups.flatMap((g) => g.items.map((i) => ({ ...i, kind: g.kind })));
  const go = (href: string) => { setOpen(false); setQ(""); input.current?.blur(); router.push(href); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(flat.length - 1, s + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    if (e.key === "Enter" && flat[sel]) { e.preventDefault(); go(flat[sel].href); }
    if (e.key === "Escape") { setOpen(false); input.current?.blur(); }
  };
  let n = -1;
  const row = (i: Item) => { n++; const idx = n; const Icon = ICON[i.kind] ?? Search; return (
    <li key={i.href + i.title}><button type="button" onMouseEnter={() => setSel(idx)} onClick={() => go(i.href)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${sel === idx ? "bg-soft" : ""}`}>
      <span className="grid size-7 shrink-0 place-items-center rounded-md border border-line bg-white"><Icon size={15} aria-hidden /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold">{i.title}</span>{i.sub && <span className="block truncate text-[12.5px] text-muted">{i.sub}</span>}</span>
      {sel === idx && <CornerDownLeft size={14} className="text-muted" aria-hidden />}</button></li>); };

  return (
    <div ref={box} className="relative mx-auto hidden w-full max-w-lg sm:block">
      <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <label htmlFor="cmd-q" className="sr-only">Search</label>
      <input id="cmd-q" ref={input} value={q} onChange={(e) => { setQ(e.target.value); setSel(0); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey} autoComplete="off" role="combobox" aria-expanded={open} aria-controls="cmd-list"
        placeholder="Search companies, tickets, projects" className="h-9 w-full rounded-lg border border-line bg-soft pl-9 pr-12 text-sm outline-none placeholder:text-muted hover:border-edge focus:border-ink/40 focus:bg-white" />
      {!open && <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-line bg-white px-1.5 py-0.5 text-[11px] font-semibold text-muted">⌘K</kbd>}
      {open && (
        <div id="cmd-list" className="absolute inset-x-0 top-full z-[60] mt-2 max-h-[min(26rem,70dvh)] overflow-y-auto rounded-xl border border-line bg-white p-1.5 shadow-[0_12px_36px_rgba(14,19,17,.14)]">
          {q.trim().length < 2 ? <ul>{quick.map(row)}</ul>
            : groups.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted">Nothing found for “{q}”. Try a reference number or part of a name.</p>
            : groups.map((g) => <div key={g.title}><p className="px-3 pb-1 pt-2 text-xs font-semibold text-muted">{g.title}</p><ul>{g.items.map((i) => row({ ...i, kind: g.kind }))}</ul></div>)}
        </div>
      )}
    </div>
  );
}
