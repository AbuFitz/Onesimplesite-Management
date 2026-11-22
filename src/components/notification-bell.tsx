"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, BellOff, Building2, CreditCard, FolderKanban, Gift, MessageCircle, ScrollText, ShieldCheck, Ticket, Users, type LucideIcon } from "lucide-react";
import { Sheet } from "./sheet";

type Notice = { id: string; at: string; title: string; sub?: string; href: string; kind: string; tone?: "good" | "warn" | "bad" };
const ICON: Record<string, LucideIcon> = { agreement: ScrollText, money: CreditCard, ticket: Ticket, reply: MessageCircle, people: Users, security: ShieldCheck, company: Building2, project: FolderKanban, referral: Gift };
const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - +new Date(iso)) / 1000);
  if (s < 60) return "now"; if (s < 3600) return `${Math.floor(s / 60)}m`; if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}d`;
};
const sameDay = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

/**
 * The bell. It lists what needs attention: replies, payments, signatures, referrals. Unread ones carry a dot and the count sits on the bell.
 * It looks again when the tab comes back and when it is opened, never on a timer, so it costs almost nothing to keep.
 */
export function NotificationBell() {
  const [items, setItems] = useState<Notice[] | null>(null);
  const [who, setWho] = useState("");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [base, setBase] = useState(0);
  const [read, setRead] = useState<string[]>([]);
  const [phone, setPhone] = useState(false);
  const last = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const path = usePathname();

  const load = useCallback(async () => {
    last.current = Date.now();
    try { const r = await fetch("/api/notifications", { cache: "no-store" }); if (r.ok) { const j = await r.json(); setWho(j.who); setItems(j.notices); } } catch { /* offline: keep what we have */ }
  }, []);
  useEffect(() => { void load(); const f = () => { if (document.visibilityState === "visible" && Date.now() - last.current > 3 * 60_000) void load(); }; document.addEventListener("visibilitychange", f); return () => document.removeEventListener("visibilitychange", f); }, [load]);
  useEffect(() => { const m = window.matchMedia("(max-width: 639px)"); const f = () => setPhone(m.matches); f(); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);
  useEffect(() => { if (!who) return; try { setBase(Number(localStorage.getItem(`oss-nt-base:${who}`)) || 0); setRead(JSON.parse(localStorage.getItem(`oss-nt-read:${who}`) ?? "[]")); } catch { /* private window */ } }, [who]);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open || phone) return;
    const out = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", out); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", out); document.removeEventListener("keydown", esc); };
  }, [open, phone]);

  const isUnread = (n: Notice) => +new Date(n.at) > base && !read.includes(n.id);
  const unread = (items ?? []).filter(isUnread).length;
  const save = (b: number, r: string[]) => { setBase(b); setRead(r); try { localStorage.setItem(`oss-nt-base:${who}`, String(b)); localStorage.setItem(`oss-nt-read:${who}`, JSON.stringify(r.slice(-200))); } catch { /* ignore */ } };
  const markAll = () => save(Date.now(), []);
  const markOne = (id: string) => { if (!read.includes(id)) save(base, [...read, id]); };
  const shown = (items ?? []).filter((n) => tab === "all" || isUnread(n));
  const today = shown.filter((n) => sameDay(n.at)), earlier = shown.filter((n) => !sameDay(n.at));

  const list = (
    <div className="nt">
      <div className="nt-head">
        <div className="sl" role="tablist" aria-label="Show"><button role="tab" aria-selected={tab === "all"} aria-current={tab === "all" ? "true" : undefined} onClick={() => setTab("all")}>All</button><button role="tab" aria-selected={tab === "unread"} aria-current={tab === "unread" ? "true" : undefined} onClick={() => setTab("unread")}>Unread{unread ? ` · ${unread}` : ""}</button></div>
        <button type="button" className="nt-mark" onClick={markAll} disabled={!unread}>Mark all read</button>
      </div>
      {items === null ? <div className="nt-empty"><span className="skel" style={{ width: "100%", height: 56 }} /></div>
        : shown.length === 0 ? <div className="nt-empty"><BellOff size={26} aria-hidden /><b>{tab === "unread" ? "Nothing unread" : "You're all caught up"}</b><span>Replies, payments and signatures show up here.</span></div>
        : [["Today", today], ["Earlier", earlier]].map(([h, rows]) => (rows as Notice[]).length > 0 && (
          <section key={h as string}><h3>{h as string}</h3>
            <ul>{(rows as Notice[]).map((n) => { const Icon = ICON[n.kind] ?? Bell; const un = isUnread(n); return (
              <li key={n.id}><Link href={n.href} onClick={() => { markOne(n.id); setOpen(false); }} className={un ? "un" : ""}>
                <span className="nt-ico" data-tone={n.tone} aria-hidden><Icon size={17} /></span>
                <span className="nt-txt"><b>{n.title}</b>{n.sub && <small>{n.sub}</small>}</span>
                <span className="nt-when">{ago(n.at)}{un && <i aria-label="Unread" />}</span>
              </Link></li>); })}</ul>
          </section>))}
    </div>
  );

  return (
    <div className="nt-wrap" ref={box}>
      <button type="button" className="nt-btn" aria-haspopup="dialog" aria-expanded={open} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} onClick={() => { setOpen((o) => !o); if (!open) void load(); }}>
        <Bell size={20} aria-hidden />{unread > 0 && <b key={unread}>{unread > 9 ? "9+" : unread}</b>}
      </button>
      {open && !phone && <div className="nt-pop" role="dialog" aria-label="Notifications">{list}</div>}
      {open && phone && <Sheet open onClose={() => setOpen(false)} title="Notifications">{list}</Sheet>}
    </div>
  );
}
