import { viewProposalByToken, ACCEPTANCE_TEXT } from "@/modules/sales/service";
import { acceptProposalAction } from "@/app/actions/public";
import { ErrorSummary, money, fmtDate } from "@/components/ui";
import { SignShell } from "@/components/public-shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proposal", robots: { index: false } };

export default async function PublicProposal({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;
  const r = await viewProposalByToken(token);
  if (!r.ok) {
    return (
      <SignShell>
        <div className="done-card mx-auto max-w-xl !text-left">
          <h1 className="text-2xl font-light tracking-tight">This link is no longer available</h1>
          <p className="mt-2 text-ink-2">It may have expired, been replaced by a newer version, or already been used. Please contact OneSimpleSite and we will send a fresh link.</p>
        </div>
      </SignShell>
    );
  }
  const v = r.version;
  return (
    <SignShell>
    <div className="done-card mx-auto max-w-2xl !text-left">
      <p className="text-sm text-muted">Proposal for {v.proposal.customer.displayName} · version {v.number}</p>
      <h1 className="mb-6 text-[28px] font-light tracking-tight">{v.proposal.title}</h1>
      <ErrorSummary message={error} />
      <div className="whitespace-pre-wrap">{v.scope}</div>
      <h2 className="mt-8 mb-2">Pricing</h2>
      <ul>{v.lines.map((l) => <li key={l.id} className="row py-2 flex justify-between gap-3"><span>{l.description}{l.quantity > 1 ? ` × ${l.quantity}` : ""}{l.recurring ? ` (every ${v.recurringPeriod ?? "period"})` : ""}</span><span className="tabular-nums">{money(l.quantity * l.unitMinor)}</span></li>)}</ul>
      <p className="mt-3">One-off total: <strong>{money(v.oneOffMinor)}</strong></p>
      {v.recurringMinor > 0 && <p>Recurring: <strong>{money(v.recurringMinor)}</strong> per {v.recurringPeriod ?? "period"}</p>}
      <p className="hint mt-1">Valid until {fmtDate(v.validUntil)}. Amounts exclude VAT unless stated in the terms.</p>
      {v.terms && <><h2 className="mt-8 mb-2">Terms</h2><div className="whitespace-pre-wrap text-sm">{v.terms}</div></>}
      <form action={acceptProposalAction} className="mt-10 space-y-4 border-t border-line pt-6">
        <input type="hidden" name="token" value={token} />
        <h2>Accept this proposal</h2>
        <div><label className="label" htmlFor="name">Your full name</label><input id="name" name="name" className="field" autoComplete="name" required /></div>
        <label className="flex items-start gap-3 text-sm"><input className="mt-1 size-5" type="checkbox" name="consent" required /><span>{ACCEPTANCE_TEXT}</span></label>
        <button className="btn w-full sm:w-auto">Accept proposal</button>
      </form>
    </div>
    </SignShell>
  );
}
