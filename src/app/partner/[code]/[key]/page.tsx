import Image from "next/image";
import { PublicFooter } from "@/components/public-links";
import { partnerView } from "@/modules/referrals/service";
import { portalLink } from "@/lib/env";
import { ShareLink } from "@/components/share-link";
import { money, timeAgo } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your referrals", robots: { index: false } };

/** An agency's or individual's own page. No login: the address itself is the key, and it is only ever shown to them. */
export default async function PartnerPage({ params }: { params: Promise<{ code: string; key: string }> }) {
  const { code, key } = await params;
  const v = await partnerView(code, key);
  return (
    <main className="ref-page">
      <i className="ref-blob" aria-hidden />
      <div className="ref-frame" style={{ width: "min(40rem, 100%)" }}>
        <Image className="logo" src="/brand/wordmark-colour.svg" alt="OneSimpleSite" width={164} height={34} priority />
        {!v ? <><h1 className="text-3xl">This page isn&apos;t available</h1><p className="mt-2 text-ink-2">Ask your contact at OneSimpleSite for your link.</p></> : (
          <div className="space-y-5">
            <div><h1 className="text-3xl">{v.name}</h1><p className="mt-1 text-ink-2">{v.rate ? `You earn ${v.rate}` : v.rateMinor ? `You earn ${money(v.rateMinor)}` : "Thanks for sending work our way"}, once the customer has paid for their website.</p></div>
            {!v.active && <p className="rounded-xl bg-[#fdeccb] px-4 py-3 text-sm font-semibold text-[#6a4300]">Your link is paused right now.</p>}
            <div className="grid grid-cols-2 gap-3"><div className="pj-stat"><span>Owed to you</span><b className="num">{money(Math.max(0, v.owed))}</b></div><div className="pj-stat"><span>Paid to you</span><b className="num">{money(v.paid)}</b></div></div>
            <div className="rounded-3xl bg-[#eceee4] p-4"><p className="mb-3 text-sm font-semibold">Your link to share</p><ShareLink url={portalLink(`/r/${v.code}`)} from={v.name} /></div>
            <div><h2 className="mb-2 text-lg">Who you&apos;ve sent</h2>{v.list.length === 0 ? <p className="text-muted">Nobody yet.</p> : <ul className="divide-y divide-line rounded-2xl border border-line bg-white px-4">{v.list.map((x) => <li key={x.id} className="flex items-center justify-between gap-3 py-3"><span className="min-w-0 truncate font-semibold">{x.name}</span><span className="shrink-0 text-sm text-muted">{x.status} · {timeAgo(x.at)}</span></li>)}</ul>}</div>
          </div>
        )}
        <PublicFooter />
      </div>
    </main>
  );
}
