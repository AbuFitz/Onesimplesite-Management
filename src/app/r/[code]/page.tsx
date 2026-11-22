import Image from "next/image";
import { Gift } from "lucide-react";
import { findByCode, getSettings } from "@/modules/referrals/service";
import { referralLeadAction } from "@/app/actions/referral-public";
import { ErrorSummary } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "A recommendation", robots: { index: false } };

export default async function ReferralLanding({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { code } = await params;
  const sp = await searchParams;
  const hit = await findByCode(code);
  const set = hit ? await getSettings(hit.workspaceId) : null;
  const on = !!set?.enabled;
  const w = set?.welcome.standard;
  const gift = w && w.months > 0 ? `${w.months} ${w.months === 1 ? "month" : "months"} ${w.label}` : null;
  return (
    <main className="ref-page">
      <i className="ref-blob" aria-hidden />
      <div className="ref-frame">
        <Image className="logo" src="/brand/wordmark-colour.svg" alt="OneSimpleSite" width={164} height={34} priority />
        {!hit || !on ? (
          <><h1 className="text-3xl">This link isn&apos;t valid any more</h1><p className="mt-2 text-ink-2">hello@onesimplesite.co.uk will help.</p></>
        ) : sp.sent ? (
          <><h1 className="text-4xl">Thank you</h1><p className="mt-2 text-ink-2">We&apos;ll be in touch within a working day.</p></>
        ) : (
          <>
            <h1 className="text-[34px] leading-[1.05] tracking-tight">{hit.name} recommended us</h1>
            {gift && <p className="ref-gift"><Gift size={16} aria-hidden /> You get {gift}</p>}
            <ErrorSummary message={sp.error} />
            <form action={referralLeadAction} className="mt-6 space-y-4">
              <input type="hidden" name="code" value={hit.code} />
              <div className="hidden" aria-hidden><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
              <div><label className="label" htmlFor="rl-b">Your business</label><input id="rl-b" name="business" className="field" required autoComplete="organization" /></div>
              <div><label className="label" htmlFor="rl-n">Your name</label><input id="rl-n" name="name" className="field" required autoComplete="name" /></div>
              <div><label className="label" htmlFor="rl-e">Email</label><input id="rl-e" name="email" type="email" className="field" required autoComplete="email" /></div>
              <div><label className="label" htmlFor="rl-p">Phone <span className="font-normal text-muted">(optional)</span></label><input id="rl-p" name="phone" type="tel" className="field" autoComplete="tel" /></div>
              <SubmitButton pendingText="Sending…">Get in touch</SubmitButton>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
