import { CookieNotice } from "@/components/cookie-notice";
import { LegalLinks } from "@/components/legal-links";
import { LiveRefresh } from "@/components/live-refresh";
import Image from "next/image";
import Link from "next/link";
import { clientCanAny } from "@/modules/portal/access";
import { requireClient } from "@/modules/identity/session";
import { signOutPortal } from "@/app/actions/auth";
import { PortalNav, PortalTabs } from "@/components/portal-nav";
import { Avatar } from "@/components/ui";

export const dynamic = "force-dynamic";
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const c = await requireClient();
  const show = [...(clientCanAny(c, "billing") ? ["/billing"] : []), ...(clientCanAny(c, "people") ? ["/people"] : [])];
  const company = c.memberships.map((m) => m.customer.displayName).join(", ");
  return (
    <div className="min-h-dvh bg-bone pb-28 sm:pb-12">
      <LiveRefresh seconds={30} />
      <header style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/overview" aria-label="Client portal home"><Image src="/brand/wordmark-colour.svg" alt="OneSimpleSite" width={140} height={29} priority /></Link>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[16rem] truncate text-sm font-semibold sm:inline">{company}</span>
            <Avatar name={c.name} size={38} staffId={c.userId} base="/avatar/u" />
            <form action={signOutPortal}><button className="btn btn-quiet !min-h-10 !px-4 text-sm">Sign out</button></form>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-2 sm:px-6"><PortalNav show={show} /></div>
      </header>
      <main id="main" className="mx-auto max-w-5xl px-4 pt-4 sm:px-6">{children}</main>
      <CookieNotice aboveTabs />
      <footer className="mx-auto max-w-5xl px-4 pb-28 pt-10 sm:px-6 sm:pb-10"><LegalLinks /></footer>
      <PortalTabs show={show} />
    </div>
  );
}
