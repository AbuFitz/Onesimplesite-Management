import { CookieNotice } from "@/components/cookie-notice";
import { LegalLinks } from "@/components/legal-links";
import { LiveRefresh } from "@/components/live-refresh";
import Image from "next/image";
import Link from "next/link";
import { clientCanAny } from "@/modules/portal/access";
import { requireClient } from "@/modules/identity/session";
import { signOutPortal } from "@/app/actions/auth";
import { PortalNav } from "@/components/portal-nav";
import { PortalDock } from "@/components/mobile-dock";
import { UserMenu } from "@/components/menus";
import { NotificationBell } from "@/components/notification-bell";
import { ReferCta } from "@/components/refer-cta";
import { getSettings as referralSettings } from "@/modules/referrals/service";

export const dynamic = "force-dynamic";
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const c = await requireClient();
  const show = [...(clientCanAny(c, "billing") ? ["/billing"] : []), ...(clientCanAny(c, "people") ? ["/people"] : [])];
  const company = c.memberships.map((m) => m.customer.displayName).join(", ");
  const rs = await referralSettings(c.memberships[0].customer.workspaceId).catch(() => null);
  const canRefer = !!rs?.enabled && c.memberships.some((m) => m.role !== "viewer");
  const amount = rs ? (rs.customerCashMinor % 100 === 0 ? `£${rs.customerCashMinor / 100}` : `£${(rs.customerCashMinor / 100).toFixed(2)}`) : "";
  return (
    <div className="min-h-dvh pb-28 sm:pb-12">
      <LiveRefresh seconds={30} />
      <header style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto max-w-5xl px-3 pt-3 sm:px-6 sm:pt-4">
          <div className="pt-bar">
            <Link href="/overview" aria-label="Client portal home" className="pt-logo"><Image src="/brand/wordmark-colour.svg" alt="OneSimpleSite" width={164} height={34} priority className="h-[24px] w-auto sm:h-[30px]" /></Link>
            <span className="pt-co">{company}</span>
            <div className="pt-act">
              {canRefer && <ReferCta amount={amount} gift={rs && rs.welcome.standard.months > 0 ? `${rs.welcome.standard.months} ${rs.welcome.standard.months === 1 ? "month" : "months"} ${rs.welcome.standard.label}` : undefined} />}
              <NotificationBell />
              <UserMenu staffId={c.userId} avatarBase="/avatar/u" name={c.name} role={company} accountLabel="Settings">
                <form action={signOutPortal}><button role="menuitem" className="pop-item w-full text-left">Sign out</button></form>
              </UserMenu>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-2 pt-3 sm:px-6"><PortalNav show={show} /></div>
      </header>
      <main id="main" className="mx-auto max-w-5xl px-4 pt-4 sm:px-6">{children}</main>
      <CookieNotice aboveTabs />
      <footer className="mx-auto max-w-5xl px-4 pb-28 pt-10 sm:px-6 sm:pb-10"><LegalLinks /></footer>
      <PortalDock show={show} />
    </div>
  );
}
