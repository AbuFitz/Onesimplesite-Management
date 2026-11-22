import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { portalLink } from "@/lib/env";
import { listReferrals, listPartners, payables, getSettings, listCustomerLinks } from "@/modules/referrals/service";
import { QuickChips, FilterPanel } from "@/components/filter-bar";
import { ConfirmForm } from "@/components/confirm";
import { CopyButton } from "@/components/copy-button";
import { Empty, Status, timeAgo, money } from "@/components/ui";
import { approveReferralAction, rejectReferralAction, reverseReferralAction, saveReferralSettingsAction, createPartnerAction, togglePartnerAction, markPaidAction } from "@/app/actions/referrals";

export const metadata = { title: "Referrals" };
const TABS = [["review", "Needs a look"], ["pending", "On the way"], ["qualified", "Rewarded"], ["payouts", "Payouts"], ["partners", "Partners"], ["links", "Customer links"], ["ended", "Ended"], ["all", "All"]] as const;
const bucket = (s: string) => (s === "rejected" || s === "reversed" ? "ended" : s);
const WORD: Record<string, { label: string; kind: "good" | "warn" | "bad" | "neutral" }> = { pending: { label: "On the way", kind: "neutral" }, review: { label: "Needs a look", kind: "warn" }, qualified: { label: "Rewarded", kind: "good" }, rejected: { label: "Rejected", kind: "bad" }, reversed: { label: "Reversed", kind: "bad" } };

export default async function Referrals({ searchParams }: { searchParams: Promise<{ tab?: string; done?: string; error?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const sp = await searchParams;
  const [all, s, partners, owing, links] = await Promise.all([listReferrals(ctx.workspaceId), getSettings(ctx.workspaceId), listPartners(ctx.workspaceId), payables(ctx.workspaceId), listCustomerLinks(ctx.workspaceId)]);
  const first = all.some((r) => r.status === "review") ? "review" : "all";
  const tab = TABS.find(([id]) => id === sp.tab)?.[0] ?? first;
  const rows = all.filter((r) => tab === "all" || bucket(r.status) === tab);
  const count = (id: string) => id === "links" ? links.length : id === "partners" ? partners.length : id === "payouts" ? owing.filter((o) => o.owedMinor > 0).length : all.filter((r) => id === "all" || bucket(r.status) === id).length;
  const owner = can(ctx.role, "settings.write");
  const here = `/referrals?tab=${tab}`;
  const owedTotal = owing.reduce((n, o) => n + Math.max(0, o.owedMinor), 0);
  const w = s.welcome;
  return (
    <>
      <h1 className="sr-only">Referrals</h1>
      <div className="lt">
        <div className="lt-row">
          <p className="lt-count !m-0 flex-1">{s.enabled ? `Paid when ${s.trigger === "final" ? "the website is fully paid" : "the deposit is paid"} · ${money(s.customerCashMinor)} to a customer · ${money(owedTotal)} owed now` : "Referrals are switched off"}</p>
          {owner && tab === "partners" && (
            <FilterPanel active={0} label="Add partner">
              <form action={createPartnerAction} className="contents">
                <input type="hidden" name="back" value={here} />
                <div className="col-span-full"><label className="label" htmlFor="pt-n">Name</label><input id="pt-n" name="name" className="field" required autoComplete="off" /></div>
                <div><label className="label" htmlFor="pt-k">Kind</label><select id="pt-k" name="kind" className="field"><option value="agency">Agency</option><option value="individual">Individual</option></select></div>
                <div><label className="label" htmlFor="pt-e">Email <span className="font-normal text-muted">(optional)</span></label><input id="pt-e" name="email" type="email" className="field" autoComplete="off" /></div>
                <div><label className="label" htmlFor="pt-t">Paid as</label><select id="pt-t" name="type" className="field"><option value="fixed">A set amount (£)</option><option value="percent">A percentage of the website</option></select></div>
                <div><label className="label" htmlFor="pt-v">Amount or %</label><input id="pt-v" name="value" type="number" min="0" step="1" defaultValue="50" className="field" required /></div>
                <button className="btn col-span-full">Add and get their link</button>
              </form>
            </FilterPanel>
          )}
          {owner && (
            <FilterPanel active={0} label="Rules">
              <form action={saveReferralSettingsAction} className="contents">
                <input type="hidden" name="back" value={here} />
                <label className="grp grp-row col-span-full" htmlFor="rs-on"><span>Referrals on</span><span className="sw"><input id="rs-on" type="checkbox" name="enabled" defaultChecked={s.enabled} /><i aria-hidden /></span></label>
                <div className="col-span-full"><label className="label" htmlFor="rs-t">Pay the referrer when</label><select id="rs-t" name="trigger" className="field" defaultValue={s.trigger}><option value="final">The website is fully paid for</option><option value="deposit">The deposit is paid</option></select></div>
                <div><label className="label" htmlFor="rs-a">Customer gets (£ cash)</label><input id="rs-a" name="cash" type="number" min="0" step="1" defaultValue={s.customerCashMinor / 100} className="field" /></div>
                <div><label className="label" htmlFor="rs-c">Most a year per customer</label><input id="rs-c" name="cap" type="number" min="1" step="1" defaultValue={s.yearlyCap} className="field" /></div>
                <div><label className="label" htmlFor="rs-m1">Website: free months</label><input id="rs-m1" name="stdMonths" type="number" min="0" max="12" defaultValue={w.standard.months} className="field" /></div>
                <div><label className="label" htmlFor="rs-l1">…of</label><input id="rs-l1" name="stdLabel" className="field" defaultValue={w.standard.label} /></div>
                <div><label className="label" htmlFor="rs-m2">Online shop: free months</label><input id="rs-m2" name="ecoMonths" type="number" min="0" max="12" defaultValue={w.ecommerce.months} className="field" /></div>
                <div><label className="label" htmlFor="rs-l2">…of</label><input id="rs-l2" name="ecoLabel" className="field" defaultValue={w.ecommerce.label} /></div>
                <button className="btn col-span-full">Save</button>
              </form>
            </FilterPanel>
          )}
        </div>
        <QuickChips label="Show" items={TABS.map(([id, l]) => ({ label: l, count: count(id), href: `/referrals?tab=${id}`, on: tab === id }))} />
      </div>
      {sp.done && <p role="status" className="mb-3 rounded-lg bg-[#dff5ea] px-3 py-2 text-sm font-semibold text-[#0a5a3d]">{sp.done}</p>}
      {sp.error && <p role="alert" className="mb-3 rounded-lg bg-[#fdecea] px-3 py-2 text-sm font-semibold text-[#a12a1f]">{sp.error}</p>}

      {tab === "links" ? (
        links.length === 0 ? <Empty title="No links yet">A customer gets their link the first time they open Refer in the portal.</Empty> : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">{links.map((l) => { const url = portalLink(`/r/${l.code}`); return (
            <li key={l.id} className="px-4 py-3.5">
              <p className="font-semibold"><Link className="hover:underline" href={`/customers/${l.customerId}`}>{l.name}</Link> <span className="font-normal text-muted">· {l.leads} {l.leads === 1 ? "lead" : "leads"} · {l.won} won</span></p>
              <p className="mt-1 break-all font-mono text-[13px] text-ink/80 select-all">{url}</p>
              <div className="mt-2"><CopyButton text={url} /></div>
            </li>); })}</ul>
        )
      ) : tab === "partners" ? (
        partners.length === 0 ? <Empty title="No partners yet">Add an agency or individual who sends you work. They get a link and a rate.</Empty> : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">{partners.map((p) => { const url = portalLink(`/r/${p.code}`); return (
            <li key={p.id} className="px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><p className="min-w-0 flex-1 font-semibold">{p.name} <span className="font-normal text-muted">· {p.kind === "agency" ? "agency" : "individual"} · {p.commissionType === "percent" ? `${p.commissionValue}% of the website` : money(p.commissionValue)}</span></p>{!p.active && <Status label="Paused" kind="warn" />}</div>
              <p className="mt-0.5 text-[13.5px] text-muted">{p.leads} {p.leads === 1 ? "lead" : "leads"} · {p.won} won · {money(Math.max(0, p.owedMinor))} owed</p>
              <p className="mt-1.5 break-all font-mono text-[13px] text-ink/80 select-all">{url}</p>
              <div className="mt-2 flex flex-wrap gap-2"><CopyButton text={url} />{owner && <form action={togglePartnerAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="active" value={p.active ? "0" : "1"} /><input type="hidden" name="back" value={here} /><button className="evt-b">{p.active ? "Pause" : "Resume"}</button></form>}</div>
            </li>); })}</ul>
        )
      ) : tab === "payouts" ? (
        owing.filter((o) => o.owedMinor !== 0).length === 0 ? <Empty title="Nobody is owed anything">Rewards show here once a referral is complete.</Empty> : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">{owing.filter((o) => o.owedMinor !== 0).map((o) => (
            <li key={o.payeeId} className="px-4 py-3.5">
              <p className="flex flex-wrap items-center gap-x-2 font-semibold">{o.type === "customer" ? <Link className="hover:underline" href={`/customers/${o.payeeId}`}>{o.name}</Link> : o.name}<span className="font-normal text-muted">· {o.type === "partner" ? "partner" : "customer"}</span><b className="ml-auto">{o.owedMinor < 0 ? `Owes us ${money(-o.owedMinor)}` : money(o.owedMinor)}</b></p>
              {owner && o.owedMinor > 0 && (
                <form action={markPaidAction} className="mt-2 flex flex-wrap items-end gap-2"><input type="hidden" name="id" value={o.payeeId} /><input type="hidden" name="back" value={here} />
                  <div><label className="label" htmlFor={`pa-${o.payeeId}`}>Paid (£)</label><input id={`pa-${o.payeeId}`} name="amount" type="number" min="1" max={o.owedMinor / 100} step="0.01" defaultValue={o.owedMinor / 100} className="field !min-h-10 w-32" /></div>
                  <div className="min-w-0 flex-1"><label className="label" htmlFor={`pn-${o.payeeId}`}>Reference</label><input id={`pn-${o.payeeId}`} name="note" className="field !min-h-10" placeholder="Bank transfer, date" /></div>
                  <button className="btn btn-quiet">Record payout</button></form>
              )}
            </li>))}</ul>
        )
      ) : rows.length === 0 ? <Empty title="Nothing here">{all.length ? "Nothing in this list." : "When a customer or partner sends someone, it shows up here."}</Empty> : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 font-semibold">{r.isPartner || !r.referrerId ? r.referrer : <Link className="hover:underline" href={`/customers/${r.referrerId}`}>{r.referrer}</Link>}<ArrowRight size={15} className="text-muted" aria-label="recommended" /><Link className="hover:underline" href={`/customers/${r.refereeId}`}>{r.referee}</Link></p>
                <Status label={WORD[r.status]?.label ?? r.status} kind={WORD[r.status]?.kind} />
              </div>
              <p className="mt-0.5 text-[13.5px] text-muted">{r.isPartner ? "Partner" : r.via === "link" ? "Their link" : "Added by the team"} · {timeAgo(r.createdAt)}{r.status === "qualified" ? ` · ${money(r.rewardMinor)} owed${r.freeMonths ? ` · ${r.freeMonths} mo ${r.freeLabel}` : ""}` : ""}{r.flag ? ` · ${r.flag}` : ""}{r.note ? ` · ${r.note}` : ""}</p>
              {owner && r.status === "review" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <form action={approveReferralAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={here} /><button className="evt-b">Looks fine, approve</button></form>
                  <ConfirmForm action={rejectReferralAction} message="Nothing will be owed for this one." confirmLabel="Reject"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={here} /><button className="evt-b evt-x">Reject</button></ConfirmForm>
                </div>
              )}
              {owner && r.status === "qualified" && (
                <ConfirmForm className="mt-2" action={reverseReferralAction} message="This takes the reward back. Do this if the order was cancelled or refunded." confirmLabel="Reverse"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={here} /><button className="evt-b evt-x">Reverse</button></ConfirmForm>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
