import type { ReactNode } from "react";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { ReferralTabs } from "@/components/referral-tabs";
import { referralItems } from "./items";
import { referralsReady } from "@/modules/referrals/service";

export default async function ReferralsLayout({ children }: { children: ReactNode }) {
  const ctx = await requireStaff("customer.read");
  if (!(await referralsReady())) return <div className="pg-card"><h1 className="text-xl">Referrals are being set up</h1><p className="mt-2 text-muted">This part is waiting for a database update. Nothing else is affected, and it will work as soon as that is done.</p></div>;
  const items = await referralItems(ctx.workspaceId, can(ctx.role, "settings.write"));
  return (
    <>
      <ReferralTabs items={[{ href: "/referrals", label: "Overview" }, ...items.map((i) => ({ href: i.href, label: i.label, badge: i.status }))]} />
      {children}
    </>
  );
}
