import { requireStaff } from "@/modules/identity/session";
import { myTeamReferrals, getSettings } from "@/modules/referrals/service";
import { portalLink } from "@/lib/env";
import { ShareLink } from "@/components/share-link";
import { money, timeAgo } from "@/components/ui";

export const metadata = { title: "My referrals" };
/** Your own link, and who you have sent. */
export default async function Mine() {
  const ctx = await requireStaff();
  const s = await getSettings(ctx.workspaceId);
  if (!s.enabled) return <p className="text-muted">Referrals are switched off right now.</p>;
  const r = await myTeamReferrals(ctx);
  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-[15px] text-muted">Anyone who fills in your link is tracked to you.{r.rewardMinor > 0 ? ` You earn ${money(r.rewardMinor)} when a company you sent has paid for its website.` : ""}</p>
      <div className="rounded-3xl bg-[#e4ecf8] p-5"><ShareLink url={portalLink(`/r/${r.code}`)} from={ctx.name} reward={r.rewardMinor > 0 ? `${money(r.rewardMinor)} when their website is paid for.` : undefined} /></div>
      {r.owed > 0 && <p className="rounded-2xl bg-[#e1f1cc] px-4 py-3 font-semibold text-[#2c4a0e]">{money(r.owed)} owed to you</p>}
      <div><h2 className="mb-2 text-lg">Who you&apos;ve sent</h2>
        {r.list.length === 0 ? <p className="text-muted">Nobody yet.</p> : <ul className="divide-y divide-line rounded-2xl border border-line bg-white px-4">{r.list.map((x) => <li key={x.id} className="flex items-center justify-between gap-3 py-3"><span className="min-w-0 truncate font-semibold">{x.name}</span><span className="shrink-0 text-sm text-muted">{x.status} · {timeAgo(x.at)}</span></li>)}</ul>}
      </div>
    </div>
  );
}
