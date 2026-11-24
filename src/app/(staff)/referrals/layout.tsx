import type { ReactNode } from "react";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { ReferralNav } from "@/components/referral-tabs";
import { ReferralAdd } from "@/components/referral-add";
import { PartnerAdd } from "@/components/partner-add";
import { referralItems } from "./items";
import { referralsReady, payables, getSettings } from "@/modules/referrals/service";
import { money } from "@/components/ui";

/** Referrals: the numbers and the two things you do most stay in a side panel while you move between sections. */
export default async function ReferralsLayout({ children }: { children: ReactNode }) {
  const ctx = await requireStaff("customer.read");
  if (!(await referralsReady())) return <div className="pg-card"><h1 className="text-xl">Referrals are being set up</h1><p className="mt-2 text-muted">This part is waiting for a database update. Nothing else is affected, and it will work as soon as that is done.</p></div>;
  const owner = can(ctx.role, "settings.write"), write = can(ctx.role, "customer.write");
  const [items, owing, s] = await Promise.all([referralItems(ctx.workspaceId, owner), payables(ctx.workspaceId), getSettings(ctx.workspaceId)]);
  const owed = owing.reduce((n, o) => n + Math.max(0, o.owedMinor), 0), who = owing.filter((o) => o.owedMinor > 0).length;
  return (
    <div className="rf-shell">
      <aside className="rf-side">
        <section className="bill-hero rf-hero" aria-label="Referrals">
          <div className="bill-hero-in">
            <p className="bill-eye">{owed > 0 ? `Owed to ${who} ${who === 1 ? "person" : "people"}` : "Referrals"}</p>
            <p className="bill-big">{owed > 0 ? money(owed) : s.enabled ? "All paid" : "Off"}</p>
            {(write && s.enabled) || owner ? (
              <div className="rf-acts">
                {write && s.enabled && <ReferralAdd workspaceId={ctx.workspaceId} back="/referrals" />}
                {owner && <PartnerAdd back="/referrals/partners" className="bill-pay rf-ghost" />}
              </div>
            ) : null}
          </div>
        </section>
        <ReferralNav items={[{ href: "/referrals", label: "Overview", icon: "overview" }, ...items.map((i) => ({ href: i.href, label: i.label, icon: i.icon as string, badge: i.status }))]} />
      </aside>
      <div className="rf-main">{children}</div>
    </div>
  );
}
