import Link from "next/link";
import { Gift } from "lucide-react";
import { db } from "@/lib/db";
import { owedTo, ensureLink, referralsReady, getCompanyDeal, effectiveReward } from "@/modules/referrals/service";
import { SheetButton } from "./sheet-button";
import { DealForm } from "./referral-deal";
import { portalLink } from "@/lib/env";
import { CopyButton } from "./copy-button";
import { attachReferrerAction, markPaidAction } from "@/app/actions/referrals";
import { money } from "./ui";

/** On a company: who recommended them, who they have recommended, and any cash we owe them. */
export async function ReferralCard({ workspaceId, customerId, canWrite, back }: { workspaceId: string; customerId: string; canWrite: boolean; back: string }) {
  if (!(await referralsReady())) return null;
  const [deal, eff] = await Promise.all([getCompanyDeal(workspaceId, customerId), effectiveReward(workspaceId, customerId)]);
  const [from, gave, owed, code] = await Promise.all([
    db.referral.findUnique({ where: { workspaceId_refereeId: { workspaceId, refereeId: customerId } } }),
    db.referral.findMany({ where: { workspaceId, referrerId: customerId }, orderBy: { createdAt: "desc" }, take: 20 }),
    owedTo(workspaceId, customerId),
    ensureLink(workspaceId, customerId),
  ]);
  const ids = [...new Set([from?.referrerId, ...gave.map((g) => g.refereeId)].filter((x): x is string => !!x))];
  const [cn, partner] = await Promise.all([db.customer.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true } }), from?.partnerId ? db.partner.findUnique({ where: { id: from.partnerId }, select: { name: true } }) : null]);
  const names = new Map(cn.map((c) => [c.id, c.displayName]));
  const [others, partners] = !from && canWrite ? await Promise.all([db.customer.findMany({ where: { workspaceId, archivedAt: null, id: { not: customerId } }, orderBy: { displayName: "asc" }, take: 300, select: { id: true, displayName: true } }), db.partner.findMany({ where: { workspaceId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })]) : [[], []];
  if (!from && gave.length === 0 && owed === 0 && !canWrite) return null;
  const state = (s: string) => (s === "qualified" ? "rewarded" : s === "review" ? "needs a look" : s === "pending" ? "on the way" : s);
  return (
    <section className="mb-8 rounded-2xl border border-[var(--card-line)] bg-white p-4" aria-label="Referrals">
      <p className="mb-2 flex items-center gap-2 font-semibold"><Gift size={17} aria-hidden />Referrals {owed > 0 && <span className="pill pill-good">{money(owed)} owed</span>}</p>
      {canWrite && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--card-rule)] p-3">
          <p className="text-sm"><span className="text-muted">Reward for each referral: </span><b>{eff.type === "percent" ? eff.text : `${eff.text} cash`}</b>{eff.months > 0 && <span className="text-muted"> · they get {eff.months} {eff.months === 1 ? "month" : "months"} {eff.label}</span>}<span className="ml-2 rounded-full bg-bone px-2 py-0.5 text-xs">{deal.type || deal.months !== null ? "Their own deal" : "Default"}</span></p>
          <SheetButton label="Change deal" title="Reward for this company" className="evt-b" icon={false}>
            <DealForm workspaceId={workspaceId} customerId={customerId} back={back} />
          </SheetButton>
        </div>
      )}
      <div className="mb-4 rounded-2xl bg-[#f4f5ee] p-3"><p className="text-sm text-muted">Their referral link</p><p className="mt-0.5 break-all font-mono text-[13px] select-all">{portalLink(`/r/${code}`)}</p><div className="mt-2"><CopyButton text={portalLink(`/r/${code}`)} /></div></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm text-muted">Recommended by</p>
          {from ? <p className="font-semibold">{from.partnerId ? (partner?.name ?? "A partner") : <Link className="hover:underline" href={`/customers/${from.referrerId}`}>{names.get(from.referrerId ?? "") ?? "A company"}</Link>} <span className="font-normal text-muted">· {state(from.status)}</span></p>
            : canWrite ? (
              <form action={attachReferrerAction} className="mt-1 flex gap-2"><input type="hidden" name="id" value={customerId} /><input type="hidden" name="back" value={back} />
                <label className="sr-only" htmlFor="rf-r">Recommended by</label><select id="rf-r" name="referrer" className="field !min-h-10 min-w-0 flex-1" defaultValue="" required><option value="" disabled>Nobody</option>{partners.length > 0 && <optgroup label="Partners">{partners.map((o) => <option key={o.id} value={`p:${o.id}`}>{o.name}</option>)}</optgroup>}<optgroup label="Customers">{others.map((o) => <option key={o.id} value={`c:${o.id}`}>{o.displayName}</option>)}</optgroup></select><button className="btn btn-quiet">Save</button></form>
            ) : <p className="text-muted">Nobody</p>}
        </div>
        <div>
          <p className="text-sm text-muted">Has recommended</p>
          {gave.length === 0 ? <p className="text-muted">Nobody yet</p> : <ul>{gave.map((g) => <li key={g.id} className="font-semibold"><Link className="hover:underline" href={`/customers/${g.refereeId}`}>{names.get(g.refereeId) ?? "A company"}</Link> <span className="font-normal text-muted">· {state(g.status)}</span></li>)}</ul>}
        </div>
      </div>
      {canWrite && owed > 0 && (
        <form action={markPaidAction} className="mt-4 flex flex-wrap items-end gap-2 border-t border-[var(--card-rule)] pt-3"><input type="hidden" name="id" value={customerId} /><input type="hidden" name="back" value={back} />
          <div><label className="label" htmlFor="uc-a">Paid out (£)</label><input id="uc-a" name="amount" type="number" min="1" max={owed / 100} step="0.01" defaultValue={owed / 100} className="field !min-h-10 w-32" required /></div>
          <div className="min-w-0 flex-1"><label className="label" htmlFor="uc-n">Reference</label><input id="uc-n" name="note" className="field !min-h-10" placeholder="Bank transfer, date" /></div>
          <button className="btn btn-quiet">Record</button>
        </form>
      )}
    </section>
  );
}
