import { LiveRefresh } from "@/components/live-refresh";
import Image from "next/image";
import Link from "next/link";
import { requireClient } from "@/modules/identity/session";
import { signOutPortal } from "@/app/actions/auth";
import { PortalNav } from "@/components/portal-nav";
import { Avatar } from "@/components/ui";

export const dynamic = "force-dynamic";
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const c = await requireClient();
  return (
    <div className="min-h-dvh bg-white">
      <LiveRefresh seconds={15} />
      <header className="border-b border-line" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto max-w-4xl px-5">
          <div className="flex h-14 items-center justify-between">
            <Link href="/overview" aria-label="Client Portal home" className="flex items-center gap-3"><Image src="/brand/wordmark-colour.svg" alt="OneSimpleSite" width={126} height={26} priority /><span className="hidden text-sm text-muted sm:inline">Client Portal</span></Link>
            <div className="flex items-center gap-3"><span className="hidden text-sm text-muted sm:inline">{c.memberships.map((m) => m.customer.displayName).join(", ")}</span><Avatar name={c.name} size={32} />
              <form action={signOutPortal}><button className="text-sm text-muted hover:text-ink min-h-10">Sign out</button></form></div>
          </div>
          <PortalNav />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-4xl px-5 pb-20 pt-8">{children}</main>
    </div>
  );
}
