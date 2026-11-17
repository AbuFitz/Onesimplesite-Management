"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Home, FolderKanban, FileText, LifeBuoy, UserRound, CreditCard, Users, Ellipsis } from "lucide-react";

const links = [["/overview", "Home", Home], ["/projects", "Projects", FolderKanban], ["/documents", "Documents", FileText], ["/billing", "Billing", CreditCard], ["/people", "People", Users], ["/help", "Get help", LifeBuoy], ["/account", "Settings", UserRound]] as const;
const pick = (show: readonly string[]) => links.filter(([h]) => !["/billing", "/people"].includes(h) || show.includes(h));
const useActive = () => { const p = usePathname().replace(/^\/portal/, "") || "/overview"; return (h: string) => p === h || p.startsWith(h + "/"); };

/** Pill navigation under the header on larger screens. */
export function PortalNav({ show = [] }: { show?: readonly string[] }) {
  const on = useActive();
  return (
    <nav aria-label="Portal" className="hidden sm:block">
      <ul className="flex w-fit gap-1 rounded-full border border-white/80 bg-white/70 p-1 shadow-[0_10px_30px_-16px_rgba(35,47,16,.28)] backdrop-blur-xl">
        {pick(show).map(([h, l, Icon]) => (
          <li key={h}><Link href={h} aria-current={on(h) ? "page" : undefined} className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-[14.5px] font-medium transition-colors ${on(h) ? "bg-ink text-white" : "text-ink-2 hover:bg-black/5"}`}><Icon size={17} aria-hidden />{l}</Link></li>
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
  const cell = (active: boolean) => `flex min-h-12 w-full flex-col items-center justify-center rounded-2xl text-[11px] font-semibold ${active ? "bg-lime text-olive-950" : "text-white/80"}`;
  return (
    <>
      {open && <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-20 bg-olive-950/35 backdrop-blur-[3px] sm:hidden" />}
      <nav aria-label="Portal" className="fixed inset-x-3 bottom-3 z-30 sm:hidden" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        {open && (
          <ul className="mb-2 overflow-hidden rounded-3xl border border-white/80 bg-white/90 p-1.5 shadow-[0_30px_60px_-24px_rgba(22,29,11,.5)] backdrop-blur-xl">
            {more.map(([h, l, Icon]) => <li key={h}><Link href={h} onClick={() => setOpen(false)} aria-current={on(h) ? "page" : undefined} className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 font-medium ${on(h) ? "bg-lime/60" : ""}`}><Icon size={19} aria-hidden />{l}</Link></li>)}
          </ul>
        )}
        <ul style={{ gridTemplateColumns: `repeat(${main.length + 1}, minmax(0, 1fr))` }} className="grid gap-1 rounded-[26px] bg-olive-950 p-1.5 shadow-[0_20px_40px_-18px_rgba(22,29,11,.7)]">
          {main.map(([h, l, Icon]) => <li key={h}><Link href={h} aria-current={on(h) ? "page" : undefined} aria-label={l} className={cell(on(h))}><Icon size={20} aria-hidden /><span>{l.replace("Get help", "Help")}</span></Link></li>)}
          <li><button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="More" className={cell(moreOn || open)}><Ellipsis size={20} aria-hidden /><span>More</span></button></li>
        </ul>
      </nav>
    </>
  );
}
