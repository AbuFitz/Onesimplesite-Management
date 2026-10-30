"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Users, Home, FolderKanban, NotebookText, FileText, Handshake, ScrollText, Menu, UserCog, DatabaseBackup, Settings2, KeyRound } from "lucide-react";

export type NavItem = { href: string; label: string; icon: string };
export type NavGroup = { label?: string; items: NavItem[] };
const icons = { today: Home, customers: Users, pipeline: Handshake, proposals: FileText, contracts: ScrollText, projects: FolderKanban, calendar: CalendarDays, notes: NotebookText, team: UserCog, backup: DatabaseBackup, settings: Settings2, vault: KeyRound } as const;
const active = (p: string, href: string) => (href === "/" ? p === "/" : p === href || p.startsWith(href + "/"));

export function SideNav({ groups }: { groups: NavGroup[] }) {
  const p = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.label && <p className="mb-1 px-3 text-xs font-semibold text-muted">{g.label}</p>}
          <ul className="flex flex-col gap-0.5">
            {g.items.map((i) => {
              const Icon = icons[i.icon as keyof typeof icons];
              const on = active(p, i.href);
              return (
                <li key={i.href}>
                  <Link href={i.href} aria-current={on ? "page" : undefined} className={`relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm ${on ? "bg-white font-semibold text-ink shadow-[0_1px_2px_rgba(14,19,17,.1)] ring-1 ring-line before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-full before:bg-moss" : "text-[#2f3833] hover:bg-white/70"}`}>
                    <Icon size={17} strokeWidth={on ? 2.2 : 1.8} aria-hidden /> {i.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Mobile bottom navigation. Every module stays reachable through More. */
export function BottomNav() {
  const p = usePathname();
  const tabs = [
    { href: "/", label: "Today", Icon: Home }, { href: "/customers", label: "Customers", Icon: Users }, { href: "/projects", label: "Projects", Icon: FolderKanban },
    { href: "/calendar", label: "Calendar", Icon: CalendarDays }, { href: "/more", label: "More", Icon: Menu },
  ];
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white/95 backdrop-blur lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {tabs.map(({ href, label, Icon }) => {
        const on = active(p, href);
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${on ? "font-semibold text-ink" : "text-muted"}`}>
            <Icon size={21} strokeWidth={on ? 2.2 : 1.7} aria-hidden /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
