"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Users, FolderKanban, FileText, Ticket, CalendarDays, MessagesSquare, ScrollText, UserCog, DatabaseBackup, Settings2, KeyRound, LifeBuoy, FlaskConical, CreditCard, Gift, Plus, LayoutGrid, UserRound, type LucideIcon } from "lucide-react";
import { Sheet } from "./sheet";

export type DockItem = { href: string; label: string; Icon: LucideIcon; badge?: number };
export type DockAction = { href: string; label: string };
const active = (p: string, href: string) => (href === "/" ? p === "/" : p === href || p.startsWith(href + "/"));

/**
 * The phone navigation: a floating bar of up to five labelled places. Every place has an icon and a name, because icons alone have to be guessed.
 * A lime "thumb" slides under the one you are on, and moves the instant you tap (before the page has loaded), so the bar always answers you.
 * "More" opens a sheet with every other place. Teams get a raised "+" in the middle for creating things.
 */
export function TabBar({ tabs, more, actions = [], moreLabel = "More", hideFrom = "lg" }: { tabs: DockItem[]; more: DockItem[]; actions?: DockAction[]; moreLabel?: string; hideFrom?: "sm" | "lg" }) {
  const path = usePathname();
  const [pending, setPending] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"more" | "add" | null>(null);
  useEffect(() => setPending(null), [path]);

  // The slots, left to right. With a create action, the "+" sits in the middle (after the first two places).
  type Slot = { kind: "tab"; item: DockItem } | { kind: "add" } | { kind: "more" };
  const half = actions.length > 0 ? Math.ceil(tabs.length / 2) : tabs.length;
  const slots: Slot[] = [...tabs.slice(0, half).map((item) => ({ kind: "tab" as const, item })), ...(actions.length ? [{ kind: "add" as const }] : []), ...tabs.slice(half).map((item) => ({ kind: "tab" as const, item })), { kind: "more" as const }];
  const here = pending ?? path;
  const idx = slots.findIndex((s) => (s.kind === "tab" ? active(here, s.item.href) : false));
  const inMore = idx < 0 && (pending === "__more" || more.some((m) => active(here, m.href)));
  const at = inMore ? slots.length - 1 : idx;
  const moreBadge = more.reduce((n, m) => n + (m.badge ?? 0), 0);
  const current = more.find((m) => active(path, m.href));

  return (
    <>
      <nav className={`tb ${hideFrom === "sm" ? "sm-hide" : ""}`} aria-label="Primary" style={{ "--n": slots.length, "--i": Math.max(0, at) } as React.CSSProperties}>
        <div className="tb-in">
          {at >= 0 && <i className="tb-thumb" aria-hidden />}
          {slots.map((s, n) => {
            if (s.kind === "add") return (
              <button key="add" type="button" className="tb-add" aria-label="Add something new" aria-haspopup="dialog" onClick={() => { navigator.vibrate?.(8); setSheet("add"); }}><Plus size={24} aria-hidden /></button>
            );
            if (s.kind === "more") return (
              <button key="more" type="button" className={`tb-t ${at === n ? "on" : ""}`} aria-haspopup="dialog" aria-expanded={sheet === "more"} onClick={() => { navigator.vibrate?.(8); setSheet("more"); }}>
                <span className="tb-i" key={at === n ? "on" : "off"}><LayoutGrid size={22} aria-hidden />{moreBadge > 0 && <b>{moreBadge}</b>}</span>
                <span className="tb-l">{moreLabel}</span>
              </button>
            );
            const it = s.item, on = at === n;
            return (
              <Link key={it.href} href={it.href} className={`tb-t ${on ? "on" : ""}`} aria-current={active(path, it.href) ? "page" : undefined} onClick={() => { navigator.vibrate?.(8); setPending(it.href); }}>
                <span className="tb-i" key={on ? "on" : "off"}><it.Icon size={22} aria-hidden />{!!it.badge && <b>{it.badge}</b>}</span>
                <span className="tb-l">{it.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <Sheet open={sheet === "more"} onClose={() => setSheet(null)} title={current ? `More · ${current.label}` : "More"}>
        <ul className="go-grid">
          {more.map((it, i) => (
            <li key={it.href} style={{ "--i": i } as React.CSSProperties}>
              <Link href={it.href} onClick={() => { setPending("__more"); setSheet(null); }} aria-current={active(path, it.href) ? "page" : undefined}>
                <span><it.Icon size={22} aria-hidden />{!!it.badge && <b>{it.badge}</b>}</span>{it.label}
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
      <Sheet open={sheet === "add"} onClose={() => setSheet(null)} title="Add something new">
        <ul className="sheet-list">{actions.map((a, i) => <li key={a.href} style={{ "--i": i } as React.CSSProperties}><Link href={a.href} onClick={() => setSheet(null)}><span><Plus size={18} aria-hidden /></span>{a.label}</Link></li>)}</ul>
      </Sheet>
    </>
  );
}

const TEAM_ICONS: Record<string, LucideIcon> = { payments: CreditCard, today: Home, customers: Users, pipeline: Ticket, proposals: FileText, contracts: ScrollText, projects: FolderKanban, calendar: CalendarDays, notes: MessagesSquare, team: UserCog, backup: DatabaseBackup, settings: Settings2, vault: KeyRound, support: LifeBuoy, testing: FlaskConical, referrals: Gift };
const TEAM_TABS = ["/", "/tickets", "/customers"];
export function TeamDock({ groups, actions }: { groups: { items: { href: string; label: string; icon: string; badge?: number }[] }[]; actions: DockAction[] }) {
  const items: DockItem[] = groups.flatMap((g) => g.items).map((i) => ({ href: i.href, label: i.label, Icon: TEAM_ICONS[i.icon] ?? Home, badge: i.badge }));
  const tabs: DockItem[] = [];
  for (const h of TEAM_TABS) { const it = items.find((i) => i.href === h); if (it) tabs.push({ ...it, label: it.href === "/" ? "Today" : it.label }); }
  return <TabBar tabs={tabs} more={items.filter((i) => !TEAM_TABS.includes(i.href))} actions={actions} />;
}

const PORTAL: Record<string, [string, LucideIcon]> = { "/overview": ["Home", Home], "/projects": ["Projects", FolderKanban], "/documents": ["Documents", FileText], "/billing": ["Billing", CreditCard], "/people": ["People", Users], "/help": ["Help", LifeBuoy], "/referrals": ["Refer a friend", Gift], "/account": ["Settings", UserRound] };
export function PortalDock({ show = [], badges = {} }: { show?: readonly string[]; badges?: Record<string, number> }) {
  const all: DockItem[] = Object.entries(PORTAL).filter(([h]) => !["/billing", "/people"].includes(h) || show.includes(h)).map(([href, [label, Icon]]) => ({ href, label, Icon, badge: badges[href] }));
  // Four places that matter most to a customer: where things stand, what to pay or read, and how to ask. The rest sit under More.
  const order = ["/overview", "/projects", show.includes("/billing") ? "/billing" : "/documents", "/help"];
  const tabs: DockItem[] = [];
  for (const h of order) { const it = all.find((i) => i.href === h); if (it) tabs.push(it); }
  return <TabBar tabs={tabs} more={all.filter((i) => !order.includes(i.href))} hideFrom="sm" />;
}
