"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [["/referrals", "Referrals"], ["/referrals/customers", "Customers"], ["/referrals/partners", "Partners"], ["/referrals/payouts", "Payouts"], ["/referrals/mine", "My referrals"], ["/referrals/rules", "Rules"]] as const;
/** The parts of referrals, each its own page: who has been sent, which customers can refer, partners, what is owed, your own link, and the rules. */
export function ReferralNav() {
  const p = usePathname();
  return (
    <nav className="ptabs ref-nav" aria-label="Referrals">
      {ITEMS.map(([href, label]) => <Link key={href} href={href} aria-current={(href === "/referrals" ? p === href : p.startsWith(href)) ? "page" : undefined}>{label}</Link>)}
    </nav>
  );
}
