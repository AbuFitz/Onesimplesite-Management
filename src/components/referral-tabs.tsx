"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** The parts of Referrals as one row of tabs across the top: the same pattern as the other lists, not a settings menu. */
export function ReferralTabs({ items }: { items: { href: string; label: string; badge?: string }[] }) {
  const path = usePathname();
  const on = (h: string) => (h === "/referrals" ? path === h : path === h || path.startsWith(h + "/"));
  return (
    <nav className="qchips mb-6" aria-label="Referrals">
      {items.map((i) => <Link key={i.href} href={i.href} className={`qchip ${on(i.href) ? "on" : ""}`} aria-current={on(i.href) ? "page" : undefined}>{i.label}{i.badge && <i>{i.badge}</i>}</Link>)}
    </nav>
  );
}
