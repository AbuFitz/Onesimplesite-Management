import { Gift } from "lucide-react";
import { requireClient } from "@/modules/identity/session";
import { portalLink } from "@/lib/env";
import { myReferrals, effectiveReward } from "@/modules/referrals/service";
import { ShareLink } from "@/components/share-link";
import { money, timeAgo } from "@/components/ui";

export const metadata = { title: "Refer a friend" };
const pounds = (m: number) => (m % 100 === 0 ? `£${m / 100}` : money(m));

export default async function Refer() {
  const c = await requireClient();
  const m = c.memberships.find((x) => x.role !== "viewer") ?? c.memberships[0];
  const rw = await effectiveReward(m.customer.workspaceId, m.customerId);
  const s = rw.settings;
  if (!s.enabled) return <section className="tile bg-white text-center !py-14"><Gift className="mx-auto mb-3" size={36} aria-hidden /><h1 className="text-2xl">Not available right now</h1></section>;
  const r = await myReferrals(m.customer.workspaceId, m.customerId);
  const url = portalLink(`/r/${r.code}`);
  return (
    <div className="space-y-4">
      <section className="tile bg-mint !p-7 sm:!p-10">
        <h1 className="text-4xl sm:text-5xl">Refer a friend</h1>
        <p className="mt-3 max-w-xl text-lg font-medium">Get <b>{rw.type === "percent" ? rw.text : `${rw.text} cash`}</b> for every business you send us{rw.months > 0 ? `. They get ${rw.months} ${rw.months === 1 ? "month" : "months"} ${rw.label}` : ""}.</p>
        <div className="mt-6"><ShareLink url={url} from={m.customer.displayName} reward={`You get ${rw.type === "percent" ? rw.text : `${rw.text} cash`} when their website is paid for.`} /></div>
      </section>
      {(r.owed > 0 || r.paid > 0) && (
        <section className="tile bg-white grid grid-cols-2 gap-4"><div><p className="text-sm text-muted">We owe you</p><p className="text-4xl">{money(Math.max(0, r.owed))}</p></div><div><p className="text-sm text-muted">Paid to you</p><p className="text-4xl">{money(r.paid)}</p></div></section>
      )}
      <section className="tile bg-white">
        <h2 className="mb-2 text-xl">Your referrals</h2>
        {r.list.length === 0 ? <p className="text-muted">Nobody yet. Send your link to get started.</p> : (
          <ul className="divide-y divide-line">{r.list.map((x) => <li key={x.id} className="flex items-center justify-between gap-3 py-3"><span className="min-w-0 truncate font-semibold">{x.name}</span><span className="shrink-0 text-sm text-muted">{x.status} · {timeAgo(x.at)}</span></li>)}</ul>
        )}
      </section>
      {r.entries.length > 0 && (
        <section className="tile bg-white"><h2 className="mb-2 text-xl">History</h2>
          <ul className="divide-y divide-line">{r.entries.map((e) => <li key={e.id} className="flex items-start justify-between gap-3 py-3"><span className="min-w-0">{e.kind === "paid" ? "Paid to you" : e.kind === "reversed" ? "Taken back" : e.note ?? "Reward"}<span className="block text-sm text-muted">{timeAgo(e.createdAt)}</span></span><b className={e.amountMinor < 0 ? "text-muted" : ""}>{e.amountMinor < 0 ? "−" : "+"}{money(Math.abs(e.amountMinor))}</b></li>)}</ul>
        </section>
      )}
    </div>
  );
}
