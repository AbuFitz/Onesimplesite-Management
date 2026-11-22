import Link from "next/link";
import { Gift } from "lucide-react";
import { db } from "@/lib/db";
import { balanceOf } from "@/modules/referrals/service";
import { attachReferrerAction, useCreditAction } from "@/app/actions/referrals";
import { money } from "./ui";

/** On a company: who recommended them, who they have recommended, and their credit. Hidden when there is nothing to say and nothing to do. */
export async function ReferralCard({ workspaceId, customerId, canWrite, back }: { workspaceId: string; customerId: string; canWrite: boolean; back: string }) {
  const [from, gave, balance] = await Promise.all([
    db.referral.findUnique({ where: { workspaceId_refereeId: { workspaceId, refereeId: customerId } } }),
    db.referral.findMany({ where: { workspaceId, referrerId: customerId }, orderBy: { createdAt: "desc" }, take: 20 }),
    balanceOf(workspaceId, customerId),
  ]);
  const ids = [...new Set([from?.referrerId, ...gave.map((g) => g.refereeId)].filter((x): x is string => !!x))];
  const names = new Map((await db.customer.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true } })).map((c) => [c.id, c.displayName]));
  const others = !from && canWrite ? await db.customer.findMany({ where: { workspaceId, archivedAt: null, id: { not: customerId } }, orderBy: { displayName: "asc" }, take: 300, select: { id: true, displayName: true } }) : [];
  if (!from && gave.length === 0 && balance === 0 && !canWrite) return null;
  const state = (s: string) => (s === "qualified" ? "rewarded" : s === "review" ? "needs a look" : s === "pending" ? "on the way" : s);
  return (
    <section className="mb-8 rounded-2xl border border-[var(--card-line)] bg-white p-4" aria-label="Referrals">
      <p className="mb-2 flex items-center gap-2 font-semibold"><Gift size={17} aria-hidden />Referrals {balance > 0 && <span className="pill pill-good">{money(balance)} credit</span>}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm text-muted">Recommended by</p>
          {from ? <p className="font-semibold"><Link className="hover:underline" href={`/customers/${from.referrerId}`}>{names.get(from.referrerId) ?? "A company"}</Link> <span className="font-normal text-muted">· {state(from.status)}</span></p>
            : canWrite ? (
              <form action={attachReferrerAction} className="mt-1 flex gap-2"><input type="hidden" name="id" value={customerId} /><input type="hidden" name="back" value={back} />
                <label className="sr-only" htmlFor="rf-r">Recommended by</label><select id="rf-r" name="referrer" className="field !min-h-10 min-w-0 flex-1" defaultValue="" required><option value="" disabled>Nobody</option>{others.map((o) => <option key={o.id} value={o.id}>{o.displayName}</option>)}</select><button className="btn btn-quiet">Save</button></form>
            ) : <p className="text-muted">Nobody</p>}
        </div>
        <div>
          <p className="text-sm text-muted">Has recommended</p>
          {gave.length === 0 ? <p className="text-muted">Nobody yet</p> : <ul>{gave.map((g) => <li key={g.id} className="font-semibold"><Link className="hover:underline" href={`/customers/${g.refereeId}`}>{names.get(g.refereeId) ?? "A company"}</Link> <span className="font-normal text-muted">· {state(g.status)}</span></li>)}</ul>}
        </div>
      </div>
      {canWrite && balance > 0 && (
        <form action={useCreditAction} className="mt-4 flex flex-wrap items-end gap-2 border-t border-[var(--card-rule)] pt-3"><input type="hidden" name="id" value={customerId} /><input type="hidden" name="back" value={back} />
          <div><label className="label" htmlFor="uc-a">Use credit (£)</label><input id="uc-a" name="amount" type="number" min="1" max={balance / 100} step="0.01" className="field !min-h-10 w-32" required /></div>
          <div className="min-w-0 flex-1"><label className="label" htmlFor="uc-n">Against what?</label><input id="uc-n" name="note" className="field !min-h-10" placeholder="e.g. website final payment" /></div>
          <button className="btn btn-quiet">Use</button>
        </form>
      )}
    </section>
  );
}
