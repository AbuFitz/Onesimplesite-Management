import Image from "next/image";
import { startAction } from "@/app/actions/start";
import { ErrorSummary } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Get started", robots: { index: false } };

/** For anyone who finds us directly: four fields, and we get back to them within a working day. */
export default async function Start({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="ref-page">
      <i className="ref-blob" aria-hidden />
      <div className="ref-frame">
        <Image className="logo" src="/brand/wordmark-colour.svg" alt="OneSimpleSite" width={164} height={34} priority />
        {sp.sent ? <><h1 className="text-4xl">Thank you</h1><p className="mt-2 text-ink-2">We&apos;ll be in touch within a working day.</p></> : (
          <>
            <h1 className="text-[34px] leading-[1.05] tracking-tight">Let&apos;s build your website</h1>
            <p className="mt-2 text-ink-2">Tell us who you are and we&apos;ll get in touch.</p>
            <ErrorSummary message={sp.error} />
            <form action={startAction} className="mt-6 space-y-4">
              <div className="hidden" aria-hidden><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
              <div><label className="label" htmlFor="st-b">Your business</label><input id="st-b" name="business" className="field" required autoComplete="organization" /></div>
              <div><label className="label" htmlFor="st-n">Your name</label><input id="st-n" name="name" className="field" required autoComplete="name" /></div>
              <div><label className="label" htmlFor="st-e">Email</label><input id="st-e" name="email" type="email" className="field" required autoComplete="email" /></div>
              <div><label className="label" htmlFor="st-p">Phone <span className="font-normal text-muted">(optional)</span></label><input id="st-p" name="phone" type="tel" className="field" autoComplete="tel" /></div>
              <SubmitButton pendingText="Sending…">Get in touch</SubmitButton>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
