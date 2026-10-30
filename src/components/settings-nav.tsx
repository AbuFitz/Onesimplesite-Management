import Link from "next/link";

const TABS = [["company", "/settings", "Company details"], ["legal", "/settings/legal", "Legal documents"], ["emails", "/settings/emails", "Emails"]] as const;

/** The same tabs on every business-settings page. */
export function SettingsNav({ current }: { current: "company" | "legal" | "emails" }) {
  return (
    <nav aria-label="Settings sections" className="mb-8 flex flex-wrap gap-2">
      {TABS.map(([id, href, label]) => <Link key={id} href={href} aria-current={id === current ? "page" : undefined} className={`btn ${id === current ? "" : "btn-quiet"}`}>{label}</Link>)}
    </nav>
  );
}
