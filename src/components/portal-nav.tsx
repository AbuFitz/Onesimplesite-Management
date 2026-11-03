"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Home, FolderKanban, FileText, LifeBuoy, UserRound, CreditCard, Users, Ellipsis } from "lucide-react";

const links = [["/overview", "Home", Home], ["/projects", "Projects", FolderKanban], ["/documents", "Documents", FileText], ["/billing", "Billing", CreditCard], ["/people", "People", Users], ["/help", "Get help", LifeBuoy], ["/account", "Account", UserRound]] as const;
const pick = (show: readonly string[]) => links.filter(([h]) => !["/billing", "/people"].includes(h) || show.includes(h));
const useActive = () => { const p = usePathname().replace(/^\/portal/, "") || "/overview"; return (h: string) => p === h || p.startsWith(h + "/"); };

/** Pill navigation under the header on larger screens. */
export function PortalNav({ show = [] }: { show?: readonly string[] }) {
  const on = useActive();
  return (
    <nav aria-label="Portal" className="hidden sm:block">
      <ul className="flex gap-1.5 rounded-2xl bg-white p-1.5 shadow-[0_1px_2px_rgba(14,19,17,.05)] w-fit">
        {pick(show).map(([h, l, Icon]) => (
          <li key={h}><Link href={h} aria-current={on(h) ? "page" : undefined} className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-[15px] font-semibold transition-colors ${on(h) ? "bg-ink text-white" : "text-ink hover:bg-bone"}`}><Icon size={17} aria-hidden />{l}</Link></li>
        ))}
      </ul>
    </nav>
  );
}

/** On a phone: four places always in reach, and everything else under More, like a banking app. */
export function PortalTabs({ show = [] }: { show?: readonly string[] }) {
  const on = useActive();
  const [open, setOpen] = useState(false);
  const items = pick(show);
  const main = items.filter(([h]) => ["/overview", "/projects", "/documents", "/help"].includes(h));
  const more = items.filter(([h]) => !["/overview", "/projects", "/documents", "/help"].includes(h));
  const moreOn = more.some(([h]) => on(h));
  const cell = (active: boolean) => `flex min-h-12 w-full flex-col items-center justify-center rounded-xl text-[11px] font-semibold ${active ? "bg-spring text-ink" : "text-white/80"}`;
  return (
    <>
      {open && <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-20 bg-ink/30 sm:hidden" />}
      <nav aria-label="Portal" className="fixed inset-x-3 bottom-3 z-30 sm:hidden" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        {open && (
          <ul className="mb-2 overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-[0_8px_30px_rgba(14,19,17,.2)]">
            {more.map(([h, l, Icon]) => <li key={h}><Link href={h} onClick={() => setOpen(false)} aria-current={on(h) ? "page" : undefined} className={`flex min-h-12 items-center gap-3 rounded-xl px-4 font-semibold ${on(h) ? "bg-bone" : ""}`}><Icon size={19} aria-hidden />{l}</Link></li>)}
          </ul>
        )}
        <ul style={{ gridTemplateColumns: `repeat(${main.length + 1}, minmax(0, 1fr))` }} className="grid gap-1 rounded-2xl bg-ink p-1.5 shadow-[0_8px_30px_rgba(14,19,17,.25)]">
          {main.map(([h, l, Icon]) => <li key={h}><Link href={h} aria-current={on(h) ? "page" : undefined} aria-label={l} className={cell(on(h))}><Icon size={20} aria-hidden /><span>{l.replace("Get help", "Help")}</span></Link></li>)}
          <li><button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="More" className={cell(moreOn || open)}><Ellipsis size={20} aria-hidden /><span>More</span></button></li>
        </ul>
      </nav>
    </>
  );
}
