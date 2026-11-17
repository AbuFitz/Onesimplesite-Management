"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Home, Users, FolderKanban, FileText, Ticket, CalendarDays, MessagesSquare, ScrollText, UserCog, DatabaseBackup, Settings2, KeyRound, LifeBuoy, FlaskConical, CreditCard, Plus, X, LayoutGrid, UserRound, type LucideIcon } from "lucide-react";
import { Sheet } from "./sheet";

export type DockItem = { href: string; label: string; Icon: LucideIcon; badge?: number };
export type DockAction = { href: string; label: string };
const active = (p: string, href: string) => (href === "/" ? p === "/" : p === href || p.startsWith(href + "/"));

/**
 * The phone navigation: a dark dock at the bottom with a round switcher button, a search pill and a plus button, and a row of swipeable quick actions.
 * The switcher opens a blurred full-screen picker: swipe a row of round icons, the centred one grows, its name appears below, tap it to go.
 * It works with a keyboard too (arrows, Enter, Escape) and the same destinations are always listed in the menu on larger screens.
 */
export function MobileDock({ items, actions, hideFrom = "lg", primary }: { items: DockItem[]; actions: DockAction[]; hideFrom?: "sm" | "lg"; primary: string[] }) {
  const path = usePathname();
  const [pick, setPick] = useState(false);
  const [plus, setPlus] = useState(false);
  const current = items.find((i) => active(path, i.href)) ?? items[0];
  const badge = items.reduce((n, i) => n + (i.badge ?? 0), 0);
  // The page you are on is the dark pill with its name; the other main places are round white buttons; the grid opens everything else.
  const others = primary.map((h) => items.find((i) => i.href === h)).filter((i): i is DockItem => !!i && i.href !== current.href).slice(0, 2);
  const Cur = current.Icon;
  return (
    <>
      <nav className={`fcap ${hideFrom === "sm" ? "sm-hide" : ""}`} aria-label="Primary">
        <Link key={current.href} href={current.href} className="fc-now" aria-current="page"><Cur size={19} aria-hidden /><span>{current.label}</span>{!!current.badge && <b>{current.badge}</b>}</Link>
        {others.map((o) => <Link key={o.href} href={o.href} className="fc-o" aria-label={o.label}><o.Icon size={20} aria-hidden />{!!o.badge && <b>{o.badge}</b>}</Link>)}
        {actions.length > 0 && <button type="button" className="fc-o fc-add" aria-label="Add something new" onClick={() => setPlus(true)}><Plus size={21} aria-hidden /></button>}
        <button type="button" className="fc-o" aria-haspopup="dialog" aria-expanded={pick} aria-label={`More pages. You are on ${current.label}`} onClick={() => setPick(true)}><LayoutGrid size={20} aria-hidden />{badge > 0 && <b>{badge}</b>}</button>
      </nav>
      {pick && <Switcher items={items} current={current.href} onClose={() => setPick(false)} />}
      <Sheet open={plus} onClose={() => setPlus(false)} title="Add something new">
        <ul className="sheet-list">{actions.map((a, i) => <li key={a.href} style={{ "--i": i } as React.CSSProperties}><Link href={a.href} onClick={() => setPlus(false)}><span><Plus size={18} aria-hidden /></span>{a.label}</Link></li>)}</ul>
      </Sheet>
    </>
  );
}

function Switcher({ items, current, onClose }: { items: DockItem[]; current: string; onClose: () => void }) {
  const router = useRouter();
  const list = useRef<HTMLUListElement>(null);
  const [idx, setIdx] = useState(Math.max(0, items.findIndex((i) => i.href === current)));
  const centre = useCallback((i: number, smooth = true) => {
    const el = list.current?.children[i] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: smooth ? "smooth" : "instant", inline: "center", block: "nearest" } as ScrollIntoViewOptions);
  }, []);
  // Scale and fade each round icon by how far it is from the middle, so the centred one stands out (the fisheye effect).
  const measure = useCallback(() => {
    const ul = list.current; if (!ul) return;
    const mid = ul.getBoundingClientRect().left + ul.clientWidth / 2;
    let best = 0, bestD = Infinity;
    Array.from(ul.children).forEach((c, i) => {
      const r = (c as HTMLElement).getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - mid);
      (c as HTMLElement).style.setProperty("--d", String(Math.min(1, d / 150)));
      if (d < bestD) { bestD = d; best = i; }
    });
    setIdx(best);
  }, []);
  useEffect(() => { centre(idx, false); measure(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") { e.preventDefault(); centre(Math.min(items.length - 1, idx + 1)); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); centre(Math.max(0, idx - 1)); }
      else if (e.key === "Enter") { e.preventDefault(); router.push(items[idx].href); onClose(); }
    };
    document.addEventListener("keydown", key); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = ""; };
  }, [idx, items, onClose, router, centre]);
  const go = (i: number) => { if (i === idx) { router.push(items[i].href); onClose(); } else centre(i); };
  return (
    <div className="switcher" role="dialog" aria-modal="true" aria-label="Go to" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <p className="sw-hint">Swipe, then tap to open</p>
      <ul ref={list} className="sw-row" onScroll={() => requestAnimationFrame(measure)}>
        {items.map((it, i) => (
          <li key={it.href}>
            <button type="button" className="sw-orb" aria-label={it.label} aria-current={i === idx ? "true" : undefined} onClick={() => go(i)}>
              <it.Icon size={30} aria-hidden />
              {!!it.badge && <b>{it.badge}</b>}
            </button>
          </li>
        ))}
      </ul>
      <p className="sw-name" aria-live="polite">{items[idx]?.label}</p>
      <button type="button" className="sw-close" aria-label="Close" onClick={onClose}><X size={24} aria-hidden /></button>
    </div>
  );
}

const TEAM_ICONS: Record<string, LucideIcon> = { payments: CreditCard, today: Home, customers: Users, pipeline: Ticket, proposals: FileText, contracts: ScrollText, projects: FolderKanban, calendar: CalendarDays, notes: MessagesSquare, team: UserCog, backup: DatabaseBackup, settings: Settings2, vault: KeyRound, support: LifeBuoy, testing: FlaskConical };
export function TeamDock({ groups, actions }: { groups: { items: { href: string; label: string; icon: string; badge?: number }[] }[]; actions: DockAction[] }) {
  const items = groups.flatMap((g) => g.items).map((i) => ({ href: i.href, label: i.label, Icon: TEAM_ICONS[i.icon] ?? Home, badge: i.badge }));
  return <MobileDock items={items} actions={actions} primary={["/", "/tickets", "/customers"]} />;
}

const PORTAL: [string, string, LucideIcon][] = [["/overview", "Home", Home], ["/projects", "Projects", FolderKanban], ["/documents", "Documents", FileText], ["/billing", "Billing", CreditCard], ["/people", "People", Users], ["/help", "Get help", LifeBuoy], ["/account", "Settings", UserRound]];
export function PortalDock({ show = [], actions }: { show?: readonly string[]; actions: DockAction[] }) {
  const items = PORTAL.filter(([h]) => !["/billing", "/people"].includes(h) || show.includes(h)).map(([href, label, Icon]) => ({ href, label, Icon }));
  return <MobileDock items={items} actions={actions} hideFrom="sm" primary={["/overview", "/projects", "/help"]} />;
}
