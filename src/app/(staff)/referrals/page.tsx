import Link from "next/link";
import { requireStaff } from "@/modules/identity/session";
import { listReferrals } from "@/modules/referrals/service";
import { db } from "@/lib/db";
import { timeAgo } from "@/components/ui";

export const metadata = { title: "Referrals" };
const stateOf = (s: string) => (s === "qualified" ? "Rewarded" : s === "review" ? "Needs a look" : s === "pending" ? "On the way" : s === "reversed" ? "Reversed" : "Declined");

/** The home of Referrals: who is owed, what needs a decision, and what has just come in. One action up top: add someone. */
export default async function ReferralsHome() {
  const ctx = await requireStaff("customer.read");
  const w = ctx.workspaceId;
  const [all, won] = await Promise.all([listReferrals(w), db.referral.count({ where: { workspaceId: w, status: "qualified" } })]);
  const review = all.filter((r) => r.status === "review"), onWay = all.filter((r) => r.status === "pending").length;
  const recent = all.slice(0, 6);
  const top = [...all.filter((r) => r.status === "qualified").reduce((m, r) => m.set(r.referrer, (m.get(r.referrer) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return (
    <div className="space-y-4">
      <h1 className="sr-only">Referrals</h1>
      {review.length > 0 && (
        <section className="rounded-2xl bg-[#fdf1d6] p-4" aria-label="Needs a look">
          <p className="mb-2 font-semibold">{review.length} {review.length === 1 ? "referral needs" : "referrals need"} a look</p>
          <ul className="divide-y divide-black/5">{review.slice(0, 4).map((r) => <li key={r.id}><Link href="/referrals/activity" className="flex items-center justify-between gap-3 py-2"><span className="min-w-0 truncate"><b>{r.referee}</b> <span className="text-muted">from {r.referrer}</span></span><span className="shrink-0 text-sm text-muted">{r.flag ?? "Check"}</span></Link></li>)}</ul>
        </section>
      )}

      <div className="pj-stats" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
        <div className="pj-stat"><span>Won</span><b className="num">{won}</b><em>referrals paid</em></div>
        <div className="pj-stat"><span>On the way</span><b className="num">{onWay}</b><em>not yet paid for</em></div>
        <div className="pj-stat"><span>Partners</span><b className="num">{new Set(all.filter((r) => r.isPartner).map((r) => r.referrer)).size}</b><em>sending us work</em></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="pg-card" aria-label="Latest">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-semibold">Latest</h2><Link href="/referrals/activity" className="text-sm underline">All activity</Link></div>
          {recent.length === 0 ? <p className="text-muted">Nobody yet. Share a customer&apos;s link, or add one by hand.</p> : <ul className="divide-y divide-[var(--card-rule)]">{recent.map((r) => <li key={r.id} className="flex items-center justify-between gap-3 py-2.5"><span className="min-w-0"><Link href={`/customers/${r.refereeId}`} className="block truncate font-semibold hover:underline">{r.referee}</Link><span className="block truncate text-sm text-muted">from {r.referrer} · {timeAgo(r.createdAt)}</span></span><span className={`pill shrink-0 ${r.status === "qualified" ? "pill-good" : r.status === "review" ? "pill-warn" : "pill-neutral"}`}>{stateOf(r.status)}</span></li>)}</ul>}
        </section>
        <section className="pg-card" aria-label="Top referrers">
          <h2 className="mb-2 text-lg font-semibold">Top referrers</h2>
          {top.length === 0 ? <p className="text-muted">They show up here once a referral is paid for.</p> : <ol className="divide-y divide-[var(--card-rule)]">{top.map(([n, c]) => <li key={n} className="flex items-center justify-between gap-3 py-2.5"><span className="truncate font-semibold">{n}</span><span className="shrink-0 text-sm text-muted">{c} won</span></li>)}</ol>}
        </section>
      </div>
    </div>
  );
}
