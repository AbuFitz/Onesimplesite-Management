"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [["/overview", "Overview"], ["/projects", "Projects"], ["/documents", "Documents"], ["/help", "Help"], ["/account", "Account"]];
export function PortalNav() {
  const p = usePathname().replace(/^\/portal/, "") || "/overview";
  return (
    <nav aria-label="Portal" className="scroll-x -mx-5 px-5 sm:mx-0 sm:px-0">
      <ul className="flex gap-6">
        {links.map(([h, l]) => {
          const on = p === h || p.startsWith(h + "/");
          return <li key={h}><Link href={h} aria-current={on ? "page" : undefined} className={`inline-flex min-h-11 items-center whitespace-nowrap border-b-2 text-sm ${on ? "border-ink font-semibold" : "border-transparent text-muted hover:text-ink"}`}>{l}</Link></li>;
        })}
      </ul>
    </nav>
  );
}
