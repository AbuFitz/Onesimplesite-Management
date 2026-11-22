import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { listReferrals, getSettings } from "@/modules/referrals/service";
import { QuickChips, FilterPanel } from "@/components/filter-bar";
import { ConfirmForm } from "@/components/confirm";
import { Empty, Status, timeAgo, money } from "@/components/ui";
import { approveReferralAction, rejectReferralAction, reverseReferralAction, saveReferralSettingsAction } from "@/app/actions/referrals";

export const metadata = { title: "Referrals" };
const TABS = [["review", "Needs a look"], ["pending", "On the way"], ["qualified", "Rewarded"], ["ended", "Ended"], ["all", "All"]] as const;
const bucket = (s: string) => (s === "rejected" || s === "reversed" ? "ended" : s);
const WORD: Record<string, { label: string; kind: "good" | "warn" | "bad" | "neutral" }> = { pending: { label: "On the way", kind: "neutral" }, review: { label: "Needs a look", kind: "warn" }, qualified: { label: "Rewarded", kind: "good" }, rejected: { label: "Rejected", kind: "bad" }, reversed: { label: "Reversed", kind: "bad" } };

export default async function Referrals({ searchParams }: { searchParams: Promise<{ tab?: string; done?: string; error?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const sp = await searchParams;
  const [all, s] = await Promise.all([listReferrals(ctx.workspaceId), getSettings(ctx.workspaceId)]);
  const first = all.some((r) => r.status === "review") ? "review" : "all";
  const tab = TABS.find(([id]) => id === sp.tab)?.[0] ?? first;
  const rows = all.filter((r) => tab === "all" || bucket(r.status) === tab);
  const count = (id: string) => all.filter((r) => id === "all" || bucket(r.status) === id).length;
  const owner = can(ctx.role, "settings.write");
  const here = `/referrals?tab=${tab}`;
  const paid = all.reduce((n, r) => n + (r.status === "qualified" ? r.rewardMinor : 0), 0);
  return (
    <>
      <h1 className="sr-only">Referrals</h1>
      <div className="lt">
        <div className="lt-row">
          <p className="lt-count !m-0 flex-1">{s.enabled ? `${money(s.referrerMinor)} for the referrer, ${money(s.refereeMinor)} for the new company · ${money(paid)} given so far` : "Referrals are switched off"}</p>
          {owner && (
            <FilterPanel active={0} label="Rewards">
              <form action={saveReferralSettingsAction} className="contents">
                <input type="hidden" name="back" value={here} />
                <label className="grp grp-row col-span-full" htmlFor="rs-on"><span>Referrals on</span><span className="sw"><input id="rs-on" type="checkbox" name="enabled" defaultChecked={s.enabled} /><i aria-hidden /></span></label>
                <div><label className="label" htmlFor="rs-a">Referrer gets (£)</label><input id="rs-a" name="referrer" type="number" min="0" max="1000" step="1" defaultValue={s.referrerMinor / 100} className="field" /></div>
                <div><label className="label" htmlFor="rs-b">New company gets (£)</label><input id="rs-b" name="referee" type="number" min="0" max="1000" step="1" defaultValue={s.refereeMinor / 100} className="field" /></div>
                <div className="col-span-full"><label className="label" htmlFor="rs-c">Most rewards per referrer a year</label><input id="rs-c" name="cap" type="number" min="1" max="200" step="1" defaultValue={s.yearlyCap} className="field" /></div>
                <button className="btn col-span-full">Save</button>
              </form>
            </FilterPanel>
          )}
        </div>
        <QuickChips label="Show" items={TABS.map(([id, l]) => ({ label: l, count: count(id), href: `/referrals?tab=${id}`, on: tab === id }))} />
      </div>
      {sp.done && <p role="status" className="mb-3 rounded-lg bg-[#dff5ea] px-3 py-2 text-sm font-semibold text-[#0a5a3d]">{sp.done}</p>}
      {sp.error && <p role="alert" className="mb-3 rounded-lg bg-[#fdecea] px-3 py-2 text-sm font-semibold text-[#a12a1f]">{sp.error}</p>}
      {rows.length === 0 ? <Empty title="Nothing here">{all.length ? "Nothing in this list." : "When a customer recommends someone, it shows up here."}</Empty> : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 font-semibold"><Link className="hover:underline" href={`/customers/${r.referrerId}`}>{r.referrer}</Link><ArrowRight size={15} className="text-muted" aria-label="recommended" /><Link className="hover:underline" href={`/customers/${r.refereeId}`}>{r.referee}</Link></p>
                <Status label={WORD[r.status]?.label ?? r.status} kind={WORD[r.status]?.kind} />
              </div>
              <p className="mt-0.5 text-[13.5px] text-muted">{r.via === "link" ? "Their link" : "Added by the team"} · {timeAgo(r.createdAt)}{r.status === "qualified" ? ` · ${money(r.rewardMinor)} in credit` : ""}{r.flag ? ` · ${r.flag}` : ""}{r.note ? ` · ${r.note}` : ""}</p>
              {owner && r.status === "review" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <form action={approveReferralAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={here} /><button className="evt-b">Looks fine, approve</button></form>
                  <ConfirmForm action={rejectReferralAction} message="No credit will be given for this one." confirmLabel="Reject"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={here} /><button className="evt-b evt-x">Reject</button></ConfirmForm>
                </div>
              )}
              {owner && r.status === "qualified" && (
                <ConfirmForm className="mt-2" action={reverseReferralAction} message="This takes both credits back. Do this if the order was cancelled or the deposit refunded." confirmLabel="Reverse"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={here} /><button className="evt-b evt-x">Reverse</button></ConfirmForm>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
