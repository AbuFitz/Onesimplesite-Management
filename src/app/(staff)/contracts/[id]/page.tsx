import { plainStatus, KIND_LABEL, isMonthly } from "@/modules/billing/service";
import { markPaidAction, cancelChargeAction, splitFeeAction, cancelPlanAction } from "@/app/actions/billing";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { sendForSigningAction, voidSigningAction, completionAction } from "@/app/actions/crm";
import { RecordHeader, Status, ErrorSummary, money, fmtDateTime } from "@/components/ui";

export const metadata = { title: "Contract" };
export default async function ContractPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; sent?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const { id } = await params;
  const sp = await searchParams;
  const k = await db.contract.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { customer: { include: { contacts: { where: { isPrimary: true }, take: 1 } } }, project: true, billingIntents: true, signingRequests: { orderBy: { createdAt: "desc" }, include: { signature: true } }, documents: { select: { sha256: true, createdAt: true } } },
  });
  if (!k) notFound();
  const pc = k.customer.contacts[0];
  const live = k.signingRequests.find((r) => r.status === "pending");
  const open = k.status === "draft" || k.status === "awaiting_signature";
  return (
    <>
      <RecordHeader back={{ href: `/customers/${k.customerId}`, label: k.customer.displayName }} title={k.title} status={<Status label={k.status.replace("_", " ")} kind={k.status === "completed" ? "good" : k.status === "declined" || k.status === "voided" ? "bad" : "warn"} />} meta={<span>{k.reference}</span>} />
      <ErrorSummary message={sp.error} />
      {sp.sent && <p role="status" className="mb-4 text-sm text-moss">Signing email queued. The worker sends it.</p>}
      <div className="grid gap-10 lg:grid-cols-[1fr_24rem]">
        <section aria-labelledby="scope"><h2 id="scope" className="mb-2">Agreement scope (from accepted proposal)</h2><div className="whitespace-pre-wrap text-sm max-w-2xl">{k.scopeSnapshot}</div></section>
        <aside className="space-y-6">
          <div><p>One-off {money(k.oneOffMinor, k.currency)}</p><p>Recurring {money(k.recurringMinor, k.currency)}</p></div>

          {open && can(ctx.role, "contract.send") && (
            <form action={sendForSigningAction} className="space-y-2"><input type="hidden" name="id" value={k.id} />
              <h2>{live ? "Reissue signing link" : "Send for signature"}</h2>
              <label className="label" htmlFor="sn">Signer name</label><input id="sn" name="name" className="field" defaultValue={pc?.name} required />
              <label className="label" htmlFor="se">Signer email (check carefully)</label><input id="se" name="email" type="email" className="field" defaultValue={pc?.email ?? ""} required />
              <button className="btn">{live ? "Void old link and resend" : "Send for signature"}</button>
              <p className="hint">The signer sees the exact text frozen now, signs on any device, and both sides get an email with the signed PDF. The link is single-use, personal and expires in 14 days.</p></form>
          )}
          {live && can(ctx.role, "contract.void") && <form action={voidSigningAction}><input type="hidden" name="id" value={k.id} /><button className="btn btn-quiet">Void contract</button></form>}

          {k.signingRequests.length > 0 && <div><p className="label">Signing history</p>{k.signingRequests.map((r) => <p key={r.id} className="text-sm">{r.signerName} · <Status label={r.status} kind={r.status === "signed" ? "good" : r.status === "pending" ? "warn" : "bad"} /> · {fmtDateTime(r.signature?.signedAt ?? r.createdAt)}{r.declineReason ? ` · “${r.declineReason}”` : ""}</p>)}</div>}

          {k.status === "completed" && (
            <div className="text-sm space-y-1">
              <p>Completed {k.completedAt && fmtDateTime(k.completedAt)} · {k.completionRecordedBy}</p>
              {k.documents[0] && <p><a className="btn btn-quiet" href={`/contracts/${k.id}/pdf`}>Download signed PDF</a> <a className="btn btn-quiet" href={`/contracts/${k.id}/evidence`}>Evidence (JSON)</a></p>}
              {k.documents[0] && <p className="hint break-all">PDF SHA-256 {k.documents[0].sha256}</p>}
              {k.project && <p><Link className="underline" href={`/projects/${k.project.id}`}>Open project</Link></p>}
            </div>
          )}

          {open && can(ctx.role, "contract.record_completion") && (
            <details><summary className="cursor-pointer min-h-11 flex items-center text-sm text-muted">Signed outside the app? Record manually</summary>
              <form action={completionAction} className="space-y-2 mt-2"><input type="hidden" name="id" value={k.id} />
                <label className="label" htmlFor="ev">Evidence</label><textarea id="ev" name="evidence" className="field" required minLength={10} placeholder="Where the signed document is held, who signed, date…" />
                <button className="btn btn-quiet">Record completion</button>
                <p className="hint">Records “completion recorded by {ctx.name}”. The app does not verify this signature.</p></form></details>
          )}

          {k.billingIntents.length > 0 && (
            <div><p className="label">Payments</p>
              <ul className="space-y-2">{k.billingIntents.map((b) => { const st = plainStatus(b.kind, b.status, b.cancelsAt); return (
                <li key={b.id} className="rounded-xl bg-bone p-3 text-sm">
                  <p className="font-semibold">{b.description ?? KIND_LABEL[b.kind] ?? b.kind} · {money(b.amountMinor, b.currency)}{isMonthly(b.kind) ? " / month" : ""}</p>
                  <p className="text-muted">{st.label}{b.paidAt ? ` · ${b.paidVia === "stripe" ? "by card" : "by bank or other"}` : ""}</p>
                  {isMonthly(b.kind) && b.stripeSubscriptionId && ["active", "past_due"].includes(b.status) && !b.cancelsAt && <form action={cancelPlanAction} className="mt-2"><input type="hidden" name="id" value={b.id} /><input type="hidden" name="back" value={`/contracts/${k.id}`} /><button className="btn btn-quiet !min-h-9" title="Stops the monthly payments after the month they've already paid for">Cancel the monthly plan</button></form>}
                  {b.status === "pending" && <div className="mt-2 flex flex-wrap gap-2">
                    {!isMonthly(b.kind) && <form action={markPaidAction}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="back" value={`/contracts/${k.id}`} /><button className="btn btn-quiet !min-h-9">Mark paid (bank)</button></form>}
                    <form action={cancelChargeAction}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="back" value={`/contracts/${k.id}`} /><button className="btn btn-quiet !min-h-9">Cancel</button></form>
                  </div>}
                </li>); })}</ul>
              {k.billingIntents.some((b) => b.kind === "one_off" && b.status === "pending") && (
                <form action={splitFeeAction} className="mt-3 flex flex-wrap items-end gap-2"><input type="hidden" name="contractId" value={k.id} /><input type="hidden" name="back" value={`/contracts/${k.id}`} />
                  <div><label className="label" htmlFor="pct">Take a deposit of</label><select id="pct" name="percent" className="field" defaultValue="50">{[25, 30, 40, 50, 60].map((n) => <option key={n} value={n}>{n}% up front</option>)}</select></div>
                  <button className="btn btn-quiet">Split website fee</button></form>)}
              <p className="hint mt-2">The customer pays by card from their portal. A website-only job simply has no monthly plan.</p>
            </div>)}
        </aside>
      </div>
    </>
  );
}
