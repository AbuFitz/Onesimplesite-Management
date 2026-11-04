import Link from "next/link";

const TABS = [["company", "/settings", "Company details"], ["plans", "/settings/plans", "Plans and details"], ["legal", "/settings/legal", "Legal documents"], ["emails", "/settings/emails", "Emails"], ["notifications", "/settings/notifications", "Notifications"]] as const;

/** The same tabs on every business-settings page. */
export function SettingsNav({ current }: { current: "company" | "plans" | "legal" | "emails" | "notifications" }) {
  return (
    <nav aria-label="Settings sections" className="mb-8 flex flex-wrap gap-2">
      {TABS.map(([id, href, label]) => <Link key={id} href={href} aria-current={id === current ? "page" : undefined} className={`btn ${id === current ? "" : "btn-quiet"}`}>{label}</Link>)}
    </nav>
  );
}
