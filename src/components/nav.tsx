"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, CalendarDays, Users, Home, FolderKanban, MessagesSquare, FileText, TicketCheck, ScrollText, Menu, UserCog, DatabaseBackup, Settings2, KeyRound, LifeBuoy, FlaskConical, CreditCard, Gift } from "lucide-react";

export type NavItem = { href: string; label: string; icon: string; badge?: number };
export type NavGroup = { label?: string; items: NavItem[] };
const icons = { payments: CreditCard, today: Home, customers: Users, pipeline: TicketCheck, proposals: FileText, contracts: ScrollText, projects: FolderKanban, calendar: CalendarDays, notes: MessagesSquare, team: UserCog, backup: DatabaseBackup, settings: Settings2, vault: KeyRound, support: LifeBuoy, testing: FlaskConical, referrals: Gift } as const;
const active = (p: string, href: string) => (href === "/" ? p === "/" : p === href || p.startsWith(href + "/"));

/** The dark olive rail (desktop). Collapses to icons with tooltips; the choice is remembered in a cookie so the page renders right first time. */
export function Rail({ groups, open: initial }: { groups: NavGroup[]; open: boolean }) {
  const p = usePathname();
  const [open, setOpen] = useState(initial);
  const flip = () => { const next = !open; setOpen(next); document.cookie = `oss_rail=${next ? "open" : "closed"}; path=/; max-age=31536000; samesite=lax`; document.querySelector(".oss-shell")?.setAttribute("data-rail", next ? "open" : "closed"); };
  return (
    <aside className="oss-rail" aria-label="Main">
      <Link href="/" aria-label="OneSimpleSite Manage, home" className="brand">
        {open ? <Image src="/brand/wordmark-reversed-colour.svg" alt="OneSimpleSite" width={150} height={31} priority /> : <Image src="/icon.svg" alt="OneSimpleSite" width={34} height={34} priority />}
      </Link>
      <nav aria-label="Primary" className="flex flex-col gap-1">
        {groups.map((g, gi) => (
          <div key={gi} className="flex flex-col gap-1">
            {g.label && <p className="cap">{g.label}</p>}
            {g.items.map((i) => {
              const Icon = icons[i.icon as keyof typeof icons];
              const on = active(p, i.href);
              return (
                <Link key={i.href} href={i.href} data-label={i.label} aria-current={on ? "page" : undefined} className="item">
                  <Icon size={19} strokeWidth={on ? 2.2 : 1.8} aria-hidden />
                  <span className="lbl">{i.label}</span>
                  {!!i.badge && <span className="badge-n" aria-label={`${i.badge} open`}>{i.badge}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="grow" />
      <button type="button" onClick={flip} className="toggle" aria-label={open ? "Collapse the menu" : "Expand the menu"} aria-expanded={open}>
        {open ? <PanelLeftClose size={19} aria-hidden /> : <PanelLeftOpen size={19} aria-hidden />}<span className="lbl">Collapse</span>
      </button>
    </aside>
  );
}

/** Phone navigation: a floating glass tab bar. Every module stays reachable through More. */
export function BottomNav() {
  const p = usePathname();
  const tabs = [
    { href: "/", label: "Today", Icon: Home }, { href: "/customers", label: "Companies", Icon: Users }, { href: "/projects", label: "Projects", Icon: FolderKanban },
    { href: "/calendar", label: "Calendar", Icon: CalendarDays }, { href: "/more", label: "More", Icon: Menu },
  ];
  return (
    <nav aria-label="Primary" className="oss-tabs">
      {tabs.map(({ href, label, Icon }) => {
        const on = active(p, href);
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined}>
            <Icon size={21} strokeWidth={on ? 2.2 : 1.7} aria-hidden /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
