"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, UserRound, Mail, KeyRound, ShieldCheck, Building2, ScrollText, Gift, Activity, Users, Handshake, Wallet, SlidersHorizontal, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const ICONS: Record<string, LucideIcon> = { profile: UserRound, email: Mail, password: KeyRound, security: ShieldCheck, companies: Building2, legal: ScrollText, referrals: Gift, activity: Activity, customers: Users, partners: Handshake, payouts: Wallet, rules: SlidersHorizontal };
export type AccountItem = { href: string; label: string; note: string; icon: keyof typeof ICONS; tint: string; status?: string };

const here = (p: string) => p.replace(/^\/portal/, "") || "/";
const on = (path: string, href: string) => path === href || path.startsWith(href + "/");

/** The rows: a coloured tile, a name with one line saying what is inside, an optional status, and a chevron. Each opens its own page. */
export function AccountRows({ items, current }: { items: AccountItem[]; current?: string }) {
  return (
    <ul className="set-rows">
      {items.map((i) => { const Icon = ICONS[i.icon]; return (
        <li key={i.href}>
          <Link href={i.href} aria-current={current && on(current, i.href) ? "page" : undefined} className="set-row">
            <span className="set-ico" style={{ background: i.tint }} aria-hidden><Icon size={19} /></span>
            <span className="set-txt"><b>{i.label}</b><small>{i.note}</small></span>
            {i.status && <em className="set-st">{i.status}</em>}
            <ChevronRight size={18} className="set-chev" aria-hidden />
          </Link>
        </li>); })}
    </ul>
  );
}

/**
 * Pages within pages. The home (/account) is a short list; each row opens its own screen. On a phone a sub-page has a "‹ back" link at the top;
 * on a computer the list stays on the left so you can jump between sections without going back.
 */
export function AccountFrame({ base, title, items, children }: { base: string; title: string; items: AccountItem[]; children: ReactNode }) {
  const path = here(usePathname());
  if (path === base) return <>{children}</>;
  return (
    <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
      <aside className="hidden lg:block">
        <Link href={base} className="set-h1 set-h1-link">{title}</Link>
        <nav aria-label={title} className="set-side"><AccountRows items={items} current={path} /></nav>
      </aside>
      <div className="min-w-0">
        <Link href={base} className="set-back lg:hidden"><ChevronLeft size={20} aria-hidden /> {title}</Link>
        {children}
      </div>
    </div>
  );
}
