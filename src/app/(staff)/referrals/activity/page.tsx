import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { listReferrals } from "@/modules/referrals/service";
import { QuickChips } from "@/components/filter-bar";
import { ConfirmForm } from "@/components/confirm";
import { Flash } from "@/components/flash";
import { Empty, Status, timeAgo, money } from "@/components/ui";
import { approveReferralAction, rejectReferralAction, reverseReferralAction } from "@/app/actions/referrals";

export const metadata = { title: "Referrals" };
const TABS = [["review", "Needs a look"], ["pending", "On the way"], ["qualified", "Rewarded"], ["ended", "Ended"], ["all", "All"]] as const;
const bucket = (s: string) => (s === "rejected" || s === "reversed" ? "ended" : s);
const WORD: Record<string, { label: string; kind: "good" | "warn" | "bad" | "neutral" }> = { pending: { label: "On the way", kind: "neutral" }, review: { label: "Needs a look", kind: "warn" }, qualified: { label: "Rewarded", kind: "good" }, rejected: { label: "Rejected", kind: "bad" }, reversed: { label: "Reversed", kind: "bad" } };

/** Everyone who has been sent to us, by customers, partners and the team, and what is happening with each. */
export default async function Referrals({ searchParams }: { searchParams: Promise<{ tab?: string; done?: string; error?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const sp = await searchParams;
    const all = await listReferrals(ctx.workspaceId);
  const tab = TABS.find(([id]) => id === sp.tab)?.[0] ?? (all.some((r) => r.status === "review") ? "review" : "all");
  const rows = all.filter((r) => tab === "all" || bucket(r.status) === tab);
  const count = (id: string) => all.filter((r) => id === "all" || bucket(r.status) === id).length;
  const owner = can(ctx.role, "settings.write");
  const here = `/referrals/activity?tab=${tab}`;
  return (
    <>
      <QuickChips label="Show" items={TABS.map(([id, l]) => ({ label: l, count: count(id), href: `/referrals/activity?tab=${id}`, on: tab === id }))} />
      <Flash done={sp.done} error={sp.error} />
      {rows.length === 0 ? <Empty title="Nothing here">{all.length ? "Nothing in this list." : "When a customer, partner or team member sends someone, it shows up here."}</Empty> : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 font-semibold">{r.isPartner || !r.referrerId ? r.referrer : <Link className="hover:underline" href={`/customers/${r.referrerId}`}>{r.referrer}</Link>}<ArrowRight size={15} className="text-muted" aria-label="sent" /><Link className="hover:underline" href={`/customers/${r.refereeId}`}>{r.referee}</Link></p>
                <Status label={WORD[r.status]?.label ?? r.status} kind={WORD[r.status]?.kind} />
              </div>
              <p className="mt-0.5 text-[13.5px] text-muted">{r.isPartner ? "Partner or team" : r.via === "link" ? "Their link" : "Added by the team"} · {timeAgo(r.createdAt)}{r.status === "qualified" ? ` · ${money(r.rewardMinor)} owed${r.freeMonths ? ` · ${r.freeMonths} mo ${r.freeLabel}` : ""}` : ""}{r.flag ? ` · ${r.flag}` : ""}{r.note ? ` · ${r.note}` : ""}</p>
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
