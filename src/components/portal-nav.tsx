"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FolderKanban, FileText, LifeBuoy, UserRound, CreditCard } from "lucide-react";

const links = [["/overview", "Home", Home], ["/projects", "Projects", FolderKanban], ["/documents", "Documents", FileText], ["/billing", "Billing", CreditCard], ["/help", "Get help", LifeBuoy], ["/account", "Account", UserRound]] as const;
const useActive = () => { const p = usePathname().replace(/^\/portal/, "") || "/overview"; return (h: string) => p === h || p.startsWith(h + "/"); };

/** Pill navigation under the header on larger screens. */
export function PortalNav() {
  const on = useActive();
  return (
    <nav aria-label="Portal" className="hidden sm:block">
      <ul className="flex gap-1.5 rounded-2xl bg-white p-1.5 shadow-[0_1px_2px_rgba(14,19,17,.05)] w-fit">
        {links.map(([h, l, Icon]) => (
          <li key={h}><Link href={h} aria-current={on(h) ? "page" : undefined} className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-[15px] font-semibold transition-colors ${on(h) ? "bg-ink text-white" : "text-ink hover:bg-bone"}`}><Icon size={17} aria-hidden />{l}</Link></li>
        ))}
      </ul>
    </nav>
  );
}

/** The same places as a bottom bar on a phone, like a banking app. */
export function PortalTabs() {
  const on = useActive();
  return (
    <nav aria-label="Portal" className="fixed inset-x-3 bottom-3 z-30 sm:hidden" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
      <ul className="grid grid-cols-6 rounded-2xl bg-ink p-1.5 shadow-[0_8px_30px_rgba(14,19,17,.25)]">
        {links.map(([h, l, Icon]) => (
          <li key={h}><Link href={h} aria-current={on(h) ? "page" : undefined} aria-label={l} className={`flex min-h-12 flex-col items-center justify-center rounded-xl text-[10.5px] font-semibold ${on(h) ? "bg-spring text-ink" : "text-white/80"}`}><Icon size={19} aria-hidden /><span>{l.replace("Get help", "Help")}</span></Link></li>
        ))}
      </ul>
    </nav>
  );
}
