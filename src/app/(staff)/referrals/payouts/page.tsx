import Link from "next/link";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { payables } from "@/modules/referrals/service";
import { Flash } from "@/components/flash";
import { Empty, money } from "@/components/ui";
import { markPaidAction } from "@/app/actions/referrals";

export const metadata = { title: "Referral payouts" };
/** Who is owed money, and a place to record each bank transfer once it is made. */
export default async function Payouts({ searchParams }: { searchParams: Promise<{ done?: string; error?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const sp = await searchParams;
  const owing = (await payables(ctx.workspaceId)).filter((o) => o.owedMinor !== 0);
  const owner = can(ctx.role, "settings.write");
  const total = owing.reduce((n, o) => n + Math.max(0, o.owedMinor), 0);
  return (
    <>
      <p className="mb-4 text-sm text-muted">{owing.length === 0 ? "Nobody is owed anything." : `${money(total)} owed in total. Pay by bank transfer, then record it here.`}</p>
      <Flash done={sp.done} error={sp.error} />
      {owing.length === 0 ? <Empty title="All paid up">Rewards show here once a referral is complete.</Empty> : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">{owing.map((o) => (
          <li key={o.payeeId} className="px-4 py-3.5">
            <p className="flex flex-wrap items-center gap-x-2 font-semibold">{o.type === "customer" ? <Link className="hover:underline" href={`/customers/${o.payeeId}`}>{o.name}</Link> : o.name}<span className="font-normal text-muted">· {o.type === "partner" ? "partner or team" : "customer"}</span><b className="ml-auto">{o.owedMinor < 0 ? `Owes us ${money(-o.owedMinor)}` : money(o.owedMinor)}</b></p>
            {owner && o.owedMinor > 0 && (
              <form action={markPaidAction} className="mt-2 flex flex-wrap items-end gap-2"><input type="hidden" name="id" value={o.payeeId} /><input type="hidden" name="back" value="/referrals/payouts" />
                <div><label className="label" htmlFor={`pa-${o.payeeId}`}>Paid (£)</label><input id={`pa-${o.payeeId}`} name="amount" type="number" min="1" max={o.owedMinor / 100} step="0.01" defaultValue={o.owedMinor / 100} className="field !min-h-10 w-32" /></div>
                <div className="min-w-0 flex-1"><label className="label" htmlFor={`pn-${o.payeeId}`}>Reference</label><input id={`pn-${o.payeeId}`} name="note" className="field !min-h-10" placeholder="Bank transfer, date" /></div>
                <button className="btn btn-quiet">Record payout</button></form>
            )}
          </li>))}</ul>
      )}
    </>
  );
}
