"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Users, UserCog, Home, FolderKanban, NotebookText, FileText, Handshake, ScrollText, Menu } from "lucide-react";

export type NavItem = { href: string; label: string; icon: string };
const icons = { today: Home, customers: Users, pipeline: Handshake, proposals: FileText, contracts: ScrollText, projects: FolderKanban, calendar: CalendarDays, notes: NotebookText, team: UserCog } as const;

const active = (p: string, href: string) => (href === "/" ? p === "/" : p === href || p.startsWith(href + "/"));

export function SideNav({ items }: { items: NavItem[] }) {
  const p = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {items.map((i) => {
        const Icon = icons[i.icon as keyof typeof icons];
        const on = active(p, i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined}
            className={`flex items-center gap-3 rounded-[8px] px-3 min-h-11 text-sm ${on ? "bg-ink text-white font-semibold" : "text-ink hover:bg-wash"}`}>
            <Icon size={18} aria-hidden /> {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile bottom nav: Today, Customers, Work, Calendar, More. All modules stay reachable via More. */
export function BottomNav() {
  const p = usePathname();
  const tabs = [
    { href: "/", label: "Today", Icon: Home },
    { href: "/customers", label: "Customers", Icon: Users },
    { href: "/projects", label: "Work", Icon: FolderKanban },
    { href: "/calendar", label: "Calendar", Icon: CalendarDays },
    { href: "/more", label: "More", Icon: Menu },
  ];
  return (
    <nav aria-label="Primary" className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-canvas border-t border-line grid grid-cols-5" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {tabs.map(({ href, label, Icon }) => {
        const on = active(p, href);
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined} className={`flex flex-col items-center justify-center gap-0.5 min-h-14 text-[11px] ${on ? "font-bold text-ink" : "text-muted"}`}>
            <Icon size={20} aria-hidden /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
