import { findByCode, getSettings } from "@/modules/referrals/service";
import { referralLeadAction } from "@/app/actions/referral-public";
import { ErrorSummary } from "@/components/ui";
import { SignShell } from "@/components/public-shell";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "A recommendation", robots: { index: false } };

export default async function ReferralLanding({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { code } = await params;
  const sp = await searchParams;
  const hit = await findByCode(code);
  const on = hit ? (await getSettings(hit.customer.workspaceId)).enabled : false;
  return (
    <SignShell>
      <div className="done-card mx-auto max-w-xl !text-left">
        {!hit || !on ? (
          <><h1 className="text-2xl font-light tracking-tight">This link isn&apos;t valid any more</h1><p className="mt-2 text-ink-2">You can still reach us at hello@onesimplesite.co.uk.</p></>
        ) : sp.sent ? (
          <><h1 className="text-2xl font-light tracking-tight">Thank you</h1><p className="mt-2 text-ink-2">We&apos;ll be in touch within a working day.</p></>
        ) : (
          <>
            <h1 className="text-[28px] font-light tracking-tight">{hit.customer.displayName} recommended us</h1>
            <p className="mt-2 text-ink-2">Tell us a little about your business and we&apos;ll get in touch. You and {hit.customer.displayName} both get a thank-you credit when your website is under way.</p>
            <ErrorSummary message={sp.error} />
            <form action={referralLeadAction} className="mt-6 space-y-4">
              <input type="hidden" name="code" value={hit.link.code} />
              <div className="hidden" aria-hidden><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
              <div><label className="label" htmlFor="rl-b">Your business</label><input id="rl-b" name="business" className="field" required autoComplete="organization" /></div>
              <div><label className="label" htmlFor="rl-n">Your name</label><input id="rl-n" name="name" className="field" required autoComplete="name" /></div>
              <div><label className="label" htmlFor="rl-e">Email</label><input id="rl-e" name="email" type="email" className="field" required autoComplete="email" /></div>
              <div><label className="label" htmlFor="rl-p">Phone <span className="font-normal text-muted">(optional)</span></label><input id="rl-p" name="phone" type="tel" className="field" autoComplete="tel" /></div>
              <SubmitButton pendingText="Sending…">Get in touch</SubmitButton>
              <p className="hint">We only use these details to reply to you.</p>
            </form>
          </>
        )}
      </div>
    </SignShell>
  );
}
