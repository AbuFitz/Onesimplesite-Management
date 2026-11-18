"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CreditCard, ScrollText, Mail, Bell, ShieldCheck, Users, DatabaseBackup, UserRound, ChevronRight, ChevronLeft, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type SettingsKey = "company" | "plans" | "team" | "legal" | "emails" | "notifications" | "security" | "backup" | "account";
type Item = { key: SettingsKey; href: string; label: string; note: string; Icon: LucideIcon; tint: string; match: string[] };
const ITEMS: Item[] = [
  { key: "account", href: "/account", label: "My account", note: "Your name, picture, password", Icon: UserRound, tint: "#6b7280", match: ["/account"] },
  { key: "company", href: "/settings/company", label: "Company details", note: "Who we are on every agreement", Icon: Building2, tint: "#4a6024", match: ["/settings/company"] },
  { key: "plans", href: "/settings/plans", label: "Plans and details", note: "Care plans and quoted details", Icon: CreditCard, tint: "#3b6ea5", match: ["/settings/plans"] },
  { key: "team", href: "/team", label: "Team", note: "Logins and access levels", Icon: Users, tint: "#7a5bb5", match: ["/team"] },
  { key: "legal", href: "/settings/legal", label: "Legal documents", note: "What customers sign", Icon: ScrollText, tint: "#b7791f", match: ["/settings/legal", "/settings/terms"] },
  { key: "emails", href: "/settings/emails", label: "Emails", note: "Preview and test each one", Icon: Mail, tint: "#2b8aa0", match: ["/settings/emails"] },
  { key: "notifications", href: "/settings/notifications", label: "Notifications", note: "Which emails are sent, and when", Icon: Bell, tint: "#c2410c", match: ["/settings/notifications"] },
  { key: "security", href: "/settings/security", label: "Sign-in security", note: "Two-step, passkeys, devices", Icon: ShieldCheck, tint: "#161d0b", match: ["/settings/security"] },
  { key: "backup", href: "/backup", label: "Backup", note: "Download a copy of your company data", Icon: DatabaseBackup, tint: "#5b6068", match: ["/backup"] },
];
const GROUPS: { title: string; keys: SettingsKey[] }[] = [
  { title: "You", keys: ["account"] },
  { title: "Company", keys: ["company", "plans", "team"] },
  { title: "Documents and emails", keys: ["legal", "emails", "notifications"] },
  { title: "Safety", keys: ["security", "backup"] },
];
const on = (i: Item, path: string) => i.match.some((m) => path === m || path.startsWith(m + "/"));

/** The rows of one group, as a calm list: a coloured icon tile, a name with its one-line purpose, and a chevron. */
function Rows({ keys, show, path, status }: { keys: SettingsKey[]; show: SettingsKey[]; path?: string; status?: Partial<Record<SettingsKey, string>> }) {
  const items = keys.filter((k) => show.includes(k)).map((k) => ITEMS.find((i) => i.key === k)!);
  if (!items.length) return null;
  return (
    <ul className="set-rows">
      {items.map((i) => (
        <li key={i.key}>
          <Link href={i.href} aria-current={path && on(i, path) ? "page" : undefined} className="set-row">
            <span className="set-ico" style={{ background: i.tint }} aria-hidden><i.Icon size={19} /></span>
            <span className="set-txt"><b>{i.label}</b><small>{i.note}</small></span>
            {status?.[i.key] && <em className="set-st">{status[i.key]}</em>}
            <ChevronRight size={18} className="set-chev" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The settings home: the sections, grouped, one tap each. On a phone it is a list; on a computer the groups sit side by side. */
export function SettingsHub({ show, status, company }: { show: SettingsKey[]; status?: Partial<Record<SettingsKey, string>>; company: { name: string; missing: string[] } }) {
  return (
    <div className="set-hub">
      <h1 className="set-h1">Settings</h1>
      <Link href="/settings/company" className="set-me">
        <span className="set-logo" aria-hidden>{company.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("")}</span>
        <span className="set-txt"><b>{company.name}</b><small>{company.missing.length ? `Still needed: ${company.missing.join(", ")}` : "Company details are complete"}</small></span>
        <ChevronRight size={18} className="set-chev" aria-hidden />
      </Link>
      <div className="set-groups">
        {GROUPS.map((g) => (
          <section key={g.title} aria-label={g.title}>
            <h2 className="set-gh">{g.title}</h2>
            <Rows keys={g.keys} show={show} status={status} />
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * Every settings page shares this frame. The home (/settings) is the hub above. A section opens as its own screen: on a phone with a
 * "‹ Settings" back link, on a computer with the grouped list on the left so you can jump between sections.
 */
export function SettingsFrame({ show, children }: { show: SettingsKey[]; children: ReactNode }) {
  const path = usePathname();
  if (path === "/settings") return <>{children}</>;
  return (
    <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
      <aside className="hidden lg:block">
        <Link href="/settings" className="set-h1 set-h1-link">Settings</Link>
        <nav aria-label="Settings sections" className="set-side">
          {GROUPS.map((g) => <section key={g.title}><h2 className="set-gh">{g.title}</h2><Rows keys={g.keys} show={show} path={path} /></section>)}
        </nav>
      </aside>
      <div className="min-w-0">
        <Link href="/settings" className="set-back lg:hidden"><ChevronLeft size={20} aria-hidden /> Settings</Link>
        {children}
      </div>
    </div>
  );
}
