import { origins } from "@/lib/env";
import { PublicSplit } from "@/components/public-split";
import { Gift } from "lucide-react";
import { findByCode, getSettings, effectiveReward } from "@/modules/referrals/service";
import { referralLeadAction } from "@/app/actions/referral-public";
import { ErrorSummary } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const hit = await findByCode((await params).code).catch(() => null);
  const title = hit ? `${hit.name} recommends OneSimpleSite` : "OneSimpleSite";
  const description = "Simple, good-looking websites for small businesses. Tap to say hello.";
  return { metadataBase: new URL(origins().portal), title, description, robots: { index: false }, openGraph: { title, description, type: "website", siteName: "OneSimpleSite" }, twitter: { card: "summary_large_image", title, description } };
}

export default async function ReferralLanding({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { code } = await params;
  const sp = await searchParams;
  const hit = await findByCode(code).catch(() => null);
  const set = hit ? await getSettings(hit.workspaceId) : null;
  const on = !!set?.enabled;
  const w = set?.welcome.standard;
  // A customer's own deal can change how many free months the people they send get.
  const months = hit?.source.customerId ? (await effectiveReward(hit.workspaceId, hit.source.customerId)).months : (w?.months ?? 0);
  const gift = w && months > 0 ? `${months} ${months === 1 ? "month" : "months"} ${w.label}` : null;
  const who = hit && on && !sp.sent ? `${hit.name} recommended us` : "Your website, all in one place.";
  return (
    <PublicSplit title={who} offer={hit && on && !sp.sent && gift ? <p className="auth-hero-gift"><Gift size={16} aria-hidden /> You get {gift}</p> : null}>
      {!hit || !on ? (
        <div className="auth-head"><h1>This link isn&apos;t valid any more</h1><p>hello@onesimplesite.co.uk will help.</p></div>
      ) : sp.sent ? (
        <div className="auth-head"><h1>Thank you</h1><p>We&apos;ll be in touch within a working day.</p></div>
      ) : (
        <>
          <div className="auth-head"><h1>Say hello</h1><p>Tell us a little about you and we&apos;ll be in touch within a working day.</p></div>
          <div className="auth-body">
            <ErrorSummary message={sp.error} />
            <form action={referralLeadAction} className="space-y-4">
              <input type="hidden" name="code" value={hit.code} />
              <div className="hidden" aria-hidden><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
              <div><label className="label" htmlFor="rl-b">Your business</label><input id="rl-b" name="business" className="field" required autoComplete="organization" /></div>
              <div><label className="label" htmlFor="rl-n">Your name</label><input id="rl-n" name="name" className="field" required autoComplete="name" /></div>
              <div><label className="label" htmlFor="rl-e">Email</label><input id="rl-e" name="email" type="email" className="field" required autoComplete="email" /></div>
              <div><label className="label" htmlFor="rl-p">Phone <span className="font-normal text-muted">(optional)</span></label><input id="rl-p" name="phone" type="tel" className="field" autoComplete="tel" /></div>
              <SubmitButton pendingText="Sending…">Get in touch</SubmitButton>
            </form>
          </div>
        </>
      )}
    </PublicSplit>
  );
}
