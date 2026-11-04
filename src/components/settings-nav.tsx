"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CreditCard, ScrollText, Mail, Bell, ShieldCheck } from "lucide-react";

type Item = { href: string; label: string; note: string; Icon: typeof Building2; match: string[]; exact?: boolean };
const GROUPS: { title: string; items: Item[] }[] = [
  { title: "Business", items: [
    { href: "/settings", label: "Company details", note: "Who we are on every agreement", Icon: Building2, match: ["/settings"] , exact: true },
    { href: "/settings/plans", label: "Plans and details", note: "Care plans and quoted details", Icon: CreditCard, match: ["/settings/plans"] },
  ] },
  { title: "Documents and emails", items: [
    { href: "/settings/legal", label: "Legal documents", note: "What customers sign", Icon: ScrollText, match: ["/settings/legal", "/settings/terms"] },
    { href: "/settings/emails", label: "Emails", note: "Preview and test each one", Icon: Mail, match: ["/settings/emails"] },
  ] },
  { title: "Alerts", items: [
    { href: "/settings/notifications", label: "Notifications", note: "Which emails are sent, and when", Icon: Bell, match: ["/settings/notifications"] },
  ] },
  { title: "Security", items: [
    { href: "/settings/security", label: "Sign-in security", note: "Two-step, passkeys, devices", Icon: ShieldCheck, match: ["/settings/security"] },
  ] },
];

/** Settings sections: a grouped side menu on a desktop, a scrolling row of pills on a phone. */
export function SettingsSidebar() {
  const path = usePathname();
  const active = (i: Item) => (i.exact ? path === i.href : i.match.some((m) => path === m || path.startsWith(m + "/")));
  const flat = GROUPS.flatMap((g) => g.items);
  return (
    <>
      <nav aria-label="Settings sections" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden [scrollbar-width:none]">
        {flat.map((i) => <Link key={i.href} href={i.href} aria-current={active(i) ? "page" : undefined} className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold ${active(i) ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"}`}><i.Icon size={15} aria-hidden />{i.label}</Link>)}
      </nav>
      <nav aria-label="Settings sections" className="sticky top-20 hidden space-y-6 lg:block">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className="mb-1.5 px-3 text-xs font-bold text-muted">{g.title}</p>
            <ul className="space-y-0.5">
              {g.items.map((i) => (
                <li key={i.href}><Link href={i.href} aria-current={active(i) ? "page" : undefined} className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${active(i) ? "bg-white shadow-[0_1px_2px_rgba(14,19,17,.08)] ring-1 ring-line" : "hover:bg-white/70"}`}>
                  <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${active(i) ? "bg-moss text-white" : "bg-white text-ink ring-1 ring-line"}`}><i.Icon size={16} aria-hidden /></span>
                  <span className="min-w-0"><span className="block text-[14px] font-semibold leading-5">{i.label}</span><span className="block text-[12.5px] leading-4 text-muted">{i.note}</span></span>
                </Link></li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
