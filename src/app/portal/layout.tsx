import Image from "next/image";
import Link from "next/link";
import { requireClient } from "@/modules/identity/session";
import { signOutPortal } from "@/app/actions/auth";

export const dynamic = "force-dynamic";
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const c = await requireClient();
  const links: [string, string][] = [["/overview", "Overview"], ["/projects", "Projects"], ["/documents", "Documents"], ["/help", "Help"], ["/account", "Account"]];
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line px-4 lg:px-8 py-3 flex flex-wrap items-center gap-x-8 gap-y-2">
        <Link href="/overview" aria-label="Client Portal home"><Image src="/brand/wordmark-colour.svg" alt="OneSimpleSite" width={140} height={28} priority /></Link>
        <nav aria-label="Portal" className="flex flex-wrap gap-1">{links.map(([h, l]) => <Link key={h} href={h} className="px-3 min-h-11 inline-flex items-center rounded-[8px] text-sm hover:bg-wash">{l}</Link>)}</nav>
        <form action={signOutPortal} className="ml-auto"><button className="btn btn-quiet">Sign out</button></form>
      </header>
      <main id="main" className="px-4 lg:px-8 py-6 max-w-4xl"><p className="text-xs text-muted mb-4">Client Portal · {c.memberships.map((m) => m.customer.displayName).join(", ")}</p>{children}</main>
    </div>
  );
}
