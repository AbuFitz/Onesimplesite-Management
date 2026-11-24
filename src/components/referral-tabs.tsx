"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Activity, Users, Handshake, Wallet, Gift, SlidersHorizontal, type LucideIcon } from "lucide-react";

const ICON: Record<string, LucideIcon> = { overview: LayoutDashboard, activity: Activity, customers: Users, partners: Handshake, payouts: Wallet, referrals: Gift, rules: SlidersHorizontal };
export type RefNavItem = { href: string; label: string; icon: string; badge?: string };

/** Down the side on a computer, underlined tabs across the top on a phone. Deliberately not the pill chips the lists use for filters. */
export function ReferralNav({ items }: { items: RefNavItem[] }) {
  const path = usePathname();
  const on = (h: string) => (h === "/referrals" ? path === h : path === h || path.startsWith(h + "/"));
  return (
    <nav className="rf-nav" aria-label="Referrals">
      {items.map((i) => { const Icon = ICON[i.icon] ?? LayoutDashboard; return (
        <Link key={i.href} href={i.href} aria-current={on(i.href) ? "page" : undefined}><Icon size={18} aria-hidden /><span>{i.label}</span>{i.badge && <em>{i.badge}</em>}</Link>
      ); })}
    </nav>
  );
}
