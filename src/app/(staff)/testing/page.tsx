import Link from "next/link";
import { requireStaff } from "@/modules/identity/session";
import { EMAILS } from "@/modules/settings/email-samples";
import { testClientStatus, TEST_CLIENT_NAME } from "@/modules/crm/test-client";
import { createTestClientAction, resetTestClientAction, sendQueuedEmailsAction, sendDigestNowAction } from "@/app/actions/testing";
import { SubmitButton } from "@/components/submit-button";
import { EmailTestButton } from "@/components/email-test-button";
import { StripeCheckButton } from "@/components/stripe-check";
import { RecordHeader, ErrorSummary, Section, fmtDateTime } from "@/components/ui";
import { mailConfigured } from "@/lib/mail";
import { queueStatus } from "@/modules/outbox/drain";
import { origins } from "@/lib/env";
import { db } from "@/lib/db";

export const metadata = { title: "Testing" };
const CARDS = [["4242 4242 4242 4242", "Payment works"], ["4000 0000 0000 9995", "Card is declined (not enough money)"], ["4000 0025 0000 3155", "Asks for extra bank approval"]];

export default async function Testing({ searchParams }: { searchParams: Promise<{ error?: string; created?: string; reset?: string; queue?: string }> }) {
  const ctx = await requireStaff("settings.write");
  const sp = await searchParams;
  const [demo, events, queue] = await Promise.all([testClientStatus(ctx), db.auditEvent.findMany({ where: { workspaceId: ctx.workspaceId, action: { startsWith: "stripe." } }, orderBy: { createdAt: "desc" }, take: 8 }), queueStatus(ctx.workspaceId)]);
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const mode = /^(sk|rk)_test_/.test(key) ? "Test mode" : /^(sk|rk)_live_/.test(key) ? "LIVE mode" : key ? "Unknown" : "Not set";
  const hook = `${origins().manage}/api/stripe/webhook`;
  const yesNo = (ok: boolean, good = "Yes", bad = "No") => <span className={`rounded-md px-2 py-0.5 text-sm font-semibold ${ok ? "bg-[#e9f6ef] text-[#0a5a3d]" : "bg-[#fde6dc] text-[#7a2e12]"}`}>{ok ? good : bad}</span>;
  return (
    <>
      <RecordHeader title="Testing" meta="Safe to play with. Test emails only go to hello@, the demo company is clearly marked, and Stripe test mode never moves real money." />
      <ErrorSummary message={sp.error} />
      {sp.created && <p role="status" className="mb-4 rounded-lg bg-[#e9f6ef] px-4 py-3 text-sm text-[#0a5a3d]">Demo company ready. A portal invitation is on its way to that email.</p>}
      {sp.reset && <p role="status" className="mb-4 rounded-lg bg-[#e9f6ef] px-4 py-3 text-sm text-[#0a5a3d]">Demo company deleted. You can start again.</p>}

      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
        <Section title="Test emails">
          <p className="mb-3 text-sm text-muted">Sends the real emails to hello@onesimplesite.co.uk, marked [TEST], so you can see exactly what customers and the team receive. {mailConfigured() ? "" : "Email isn't configured here, so they won't be delivered."}</p>
          <EmailTestButton label="Send every email" />
          <details className="mt-4"><summary className="min-h-10 cursor-pointer text-sm font-semibold">Or send just one</summary>
            <ul className="mt-2 space-y-1">{EMAILS.map((e) => <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 text-sm"><span><strong>{e.label}</strong> <span className="text-muted">· {e.audience}</span></span><EmailTestButton only={e.id} label="Send" /></li>)}</ul></details>
          <div className="mt-5 rounded-xl bg-bone p-4 text-sm">
            <p className="font-semibold">Email queue</p>
            <p className="text-muted">{queue.pending} waiting to send · {queue.failed} failed · email is {queue.configured ? "switched on" : "not configured"}</p>
            {queue.recent.length > 0 && <ul className="mt-2 space-y-1 text-[13px] text-[#7a2e12]">{queue.recent.slice(0, 3).map((r) => <li key={r.id}>{r.lastError}</li>)}</ul>}
            <form action={sendDigestNowAction} className="mt-3"><SubmitButton className="btn btn-quiet" pendingText="Sending…">Send the daily summary now</SubmitButton></form>
            <form action={sendQueuedEmailsAction} className="mt-3"><SubmitButton className="btn btn-quiet" pendingText="Sending…">Send waiting emails now</SubmitButton></form>
            {sp.queue && <p role="status" className="mt-2 text-moss">{sp.queue}</p>}
          </div>
          <p className="mt-3 text-sm"><Link className="underline" href="/settings/emails">Preview how each one looks</Link></p>
        </Section>

        <Section title="Test client">
          <p className="mb-3 text-sm text-muted">A demo company ({TEST_CLIENT_NAME}) with a signed website order, a £49 monthly plan and a project, so you can use the whole client portal for real.</p>
          {demo && (
            <div className="mb-4 rounded-xl bg-bone p-4 text-sm">
              <p><strong>{TEST_CLIENT_NAME}</strong> · {demo.reference}</p>
              <p className="text-muted">Portal login email: {demo.email ?? "none"} · {demo.signedUp ? "login created" : demo.invitePending ? "invitation sent, not accepted yet" : "no invitation waiting"}</p>
              <p className="mt-2 flex flex-wrap gap-3"><Link className="underline" href={`/customers/${demo.id}`}>Open the company</Link><a className="underline" href={`${origins().portal}/login`} target="_blank" rel="noreferrer">Open the client portal</a></p>
            </div>
          )}
          <form action={createTestClientAction} className="flex flex-wrap items-end gap-3">
            <div className="min-w-60 flex-1"><label className="label" htmlFor="demo-email">{demo ? "Send a new portal invitation to" : "Send the portal invitation to"}</label><input id="demo-email" name="email" type="email" className="field" autoComplete="off" required /></div>
            <SubmitButton>{demo ? "Send invitation" : "Create test client"}</SubmitButton>
          </form>
          <p className="hint mt-2">Use an email that isn't your team login. With Gmail, add +test (you+test@gmail.com) and it still lands in your inbox.</p>
          {demo && <form action={resetTestClientAction} className="mt-4"><button className="btn btn-quiet">Delete the demo company and start again</button></form>}
        </Section>

        <Section title="Stripe">
          <dl className="mb-4 text-sm">
            <div className="row flex items-center justify-between gap-4 py-2"><dt>Secret key set</dt><dd>{yesNo(!!key)}</dd></div>
            <div className="row flex items-center justify-between gap-4 py-2"><dt>Mode</dt><dd><span className={`rounded-md px-2 py-0.5 font-semibold ${mode === "Test mode" ? "bg-[#fbf3d5] text-[#5c4700]" : mode === "LIVE mode" ? "bg-[#fde6dc] text-[#7a2e12]" : "bg-bone"}`}>{mode}</span></dd></div>
            <div className="row flex items-center justify-between gap-4 py-2"><dt>Webhook secret set</dt><dd>{yesNo(!!process.env.STRIPE_WEBHOOK_SECRET)}</dd></div>
          </dl>
          <StripeCheckButton />
          <div className="mt-5 text-sm">
            <p className="font-semibold">Webhook address to give Stripe</p>
            <p className="mt-1 break-all rounded-lg bg-bone px-3 py-2 font-mono text-[13px]">{hook}</p>
            <p className="mt-2 text-muted">Events: checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted.</p>
          </div>
          <div className="mt-5 text-sm"><p className="font-semibold">Test cards</p>
            <ul className="mt-1">{CARDS.map(([n, w]) => <li key={n} className="row flex justify-between gap-3 py-1.5"><span className="font-mono text-[13px]">{n}</span><span className="text-muted">{w}</span></li>)}</ul>
            <p className="mt-1 text-muted">Any future date, any 3 digit code, any postcode.</p></div>
          <div className="mt-5 text-sm"><p className="font-semibold">Latest Stripe events received</p>
            {events.length === 0 ? <p className="mt-1 text-muted">None yet. Use “Send test event” on the webhook in Stripe, or pay with a test card.</p> : <ul className="mt-1">{events.map((e) => <li key={e.id} className="row flex justify-between gap-3 py-1.5"><span className="break-all">{e.action.replace("stripe.", "")}</span><span className="shrink-0 text-muted">{fmtDateTime(e.createdAt)}</span></li>)}</ul>}</div>
        </Section>

        <Section title="How to test a payment, start to finish">
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Create the test client above and accept the invitation from the email. Set a password and sign in to the portal.</li>
            <li>Open <strong>Billing</strong>. Press <strong>Pay now</strong> on the website fee, and pay with the test card 4242.</li>
            <li>You land back on Billing and it changes to <strong>Paid</strong>. You get a payment received email, and hello@ gets a notice.</li>
            <li>Press <strong>Start plan</strong> for the monthly plan, pay with 4242, and check it says <strong>Active</strong>.</li>
            <li>In Stripe, try the declined card on another test to see the “payment didn't go through” email.</li>
          </ol>
        </Section>
      </div>
    </>
  );
}
