import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { AccountRows } from "@/components/account-nav";
import { payables, getSettings, rewardText } from "@/modules/referrals/service";
import { db } from "@/lib/db";
import { money } from "@/components/ui";
import { referralItems } from "./items";

export const metadata = { title: "Referrals" };
/** The home of Referrals: the numbers that matter, then each part of it as its own page. */
export default async function ReferralsHome() {
  const ctx = await requireStaff("customer.read");
  const w = ctx.workspaceId;
  const [items, s, owing, won, live] = await Promise.all([referralItems(w, can(ctx.role, "settings.write")), getSettings(w), payables(w), db.referral.count({ where: { workspaceId: w, status: "qualified" } }), db.referral.count({ where: { workspaceId: w, status: "pending" } })]);
  const owed = owing.reduce((n, o) => n + Math.max(0, o.owedMinor), 0);
  return (
    <div className="set-hub">
      <h1 className="sr-only">Referrals</h1>
      <div className="pj-stats" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(9rem,1fr))" }}>
        <div className="pj-stat"><span>Won</span><b className="num">{won}</b><em>referrals paid</em></div>
        <div className="pj-stat"><span>On the way</span><b className="num">{live}</b><em>not yet paid for</em></div>
        <div className="pj-stat"><span>Owed now</span><b className="num">{money(owed)}</b><em>to customers and partners</em></div>
        <div className="pj-stat"><span>Default reward</span><b className="num">{rewardText(s.customerType, s.customerValue)}</b><em>{s.enabled ? "per customer referral" : "switched off"}</em></div>
      </div>
      <div className="mt-4"><AccountRows items={items} /></div>
    </div>
  );
}
