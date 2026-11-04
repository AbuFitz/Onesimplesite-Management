import { plainStatus, KIND_LABEL, isMonthly, isScheduled } from "@/modules/billing/service";
import { requestFinalPaymentAction, markPaidAction, cancelChargeAction, splitFeeAction, cancelPlanAction, setPlanOfferAction } from "@/app/actions/billing";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { sendForSigningAction, voidSigningAction, completionAction } from "@/app/actions/crm";
import { RecordHeader, Status, ErrorSummary, money, fmtDateTime, fmtDate } from "@/components/ui";
import { Panel, SummaryTile, FactRow } from "@/components/panel";
import { FileText, PenLine, CreditCard, FolderKanban, Download } from "lucide-react";

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
  const receiptsBy = new Map<string, { id: string; ref: string; paidAt: Date }[]>();
  for (const r of await db.receipt.findMany({ where: { intentId: { in: k.billingIntents.map((b) => b.id) } }, orderBy: { paidAt: "asc" }, select: { id: true, ref: true, paidAt: true, intentId: true } })) receiptsBy.set(r.intentId, [...(receiptsBy.get(r.intentId) ?? []), r]);
  const live = k.signingRequests.find((r) => r.status === "pending");
  const open = k.status === "draft" || k.status === "awaiting_signature";
  const TONE = { due: "bg-[#f8ecbf] text-[#5c4700]", ok: "bg-[#d7f3e6] text-[#0a5a3d]", warn: "bg-[#fbdccf] text-[#7a2e12]", off: "bg-[#ebe9e1] text-ink/70" } as const;
  const stateTone = k.status === "completed" ? "green" : k.status === "declined" || k.status === "voided" ? "rose" : "amber";
  const stateText = ({ completed: "Signed", awaiting_signature: "Waiting to sign", draft: "Not sent yet", declined: "Declined", voided: "Withdrawn" } as Record<string, string>)[k.status] ?? k.status.replaceAll("_", " ");
  const btn = "btn btn-quiet !min-h-11 sm:!min-h-9";
  return (
    <>
      <RecordHeader back={{ href: `/customers/${k.customerId}`, label: k.customer.displayName }} title={k.title} status={<Status label={stateText} kind={k.status === "completed" ? "good" : k.status === "declined" || k.status === "voided" ? "bad" : "warn"} />} meta={<span>{k.reference}</span>} />
      <ErrorSummary message={sp.error} />
      {sp.sent && <p role="status" className="mb-4 rounded-lg bg-[#d7f3e6] px-4 py-3 text-sm font-semibold text-[#0a5a3d]">Signing email on its way.</p>}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile label="Status" value={stateText} sub={k.completedAt ? fmtDate(k.completedAt) : undefined} tone={stateTone} />
        <SummaryTile label="Website" value={money(k.oneOffMinor, k.currency)} sub="one-off" tone="blue" />
        <SummaryTile label="Monthly plan" value={k.recurringMinor ? money(k.recurringMinor, k.currency) : "None"} sub={k.recurringMinor ? "every month" : "website only"} tone="lilac" />
        <SummaryTile label="Company" value={<Link className="underline decoration-ink/30 underline-offset-2" href={`/customers/${k.customerId}`}>{k.customer.displayName}</Link>} sub={pc ? pc.name : undefined} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-5">
          <Panel title="What was agreed" icon={FileText} tone="blue"><div className="max-w-2xl whitespace-pre-wrap text-[15px] leading-relaxed">{k.scopeSnapshot}</div></Panel>

          <Panel title="Signing" icon={PenLine} tone="green">
            {k.status === "completed" ? (
              <div className="space-y-3">
                <dl><FactRow label="Signed by">{k.signingRequests.find((r) => r.status === "signed")?.signerName ?? k.completionRecordedBy}</FactRow><FactRow label="Signed on">{k.completedAt && fmtDateTime(k.completedAt)}</FactRow></dl>
                {k.documents[0] && <div className="flex flex-wrap gap-2"><a className={btn} href={`/contracts/${k.id}/pdf`}><Download size={15} aria-hidden /> Signed PDF</a><a className={btn} href={`/contracts/${k.id}/evidence`}>Evidence (JSON)</a></div>}
                {k.documents[0] && <p className="break-all text-xs text-ink/55">Fingerprint (SHA-256) {k.documents[0].sha256}</p>}
              </div>
            ) : k.signingRequests.length === 0 ? <p className="text-[15px] text-ink/70">Not sent yet. Send it for signature and the customer gets one email with one signature to make.</p> : null}
            {k.signingRequests.length > 0 && <div className="mt-3 flex flex-wrap gap-2"><a className={btn} href={`/contracts/${k.id}/document`}>View the agreement as sent</a></div>}
            {k.signingRequests.length > 0 && (
              <ul className={k.status === "completed" ? "mt-4 border-t border-[#eceeec] pt-3" : ""}>{k.signingRequests.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eceeec] py-2 text-[15px] last:border-0"><span className="font-medium">{r.signerName}</span><span className="flex items-center gap-2 text-ink/70"><Status label={r.status} kind={r.status === "signed" ? "good" : r.status === "pending" ? "warn" : "bad"} />{fmtDateTime(r.signature?.signedAt ?? r.createdAt)}</span>{r.declineReason && <span className="basis-full text-sm">“{r.declineReason}”</span>}</li>)}</ul>
            )}
            {open && can(ctx.role, "contract.send") && (
              <form action={sendForSigningAction} className="mt-4 space-y-2 rounded-xl bg-[#f6f5f1] p-4"><input type="hidden" name="id" value={k.id} />
                <h3 className="text-[15px] font-bold">{live ? "Send a fresh signing link" : "Send for signature"}</h3>
                <div className="grid gap-3 sm:grid-cols-2"><div><label className="label" htmlFor="sn">Signer name</label><input id="sn" name="name" className="field" defaultValue={pc?.name} required /></div>
                  <div><label className="label" htmlFor="se">Signer email</label><input id="se" name="email" type="email" className="field" defaultValue={pc?.email ?? ""} required /></div></div>
                <button className="btn">{live ? "Withdraw the old link and resend" : "Send for signature"}</button>
                <p className="text-sm text-ink/65">One email, one signature. The link is personal, works once and expires in 14 days. Check the email address carefully.</p></form>
            )}
            {live && can(ctx.role, "contract.void") && <form action={voidSigningAction} className="mt-3"><input type="hidden" name="id" value={k.id} /><button className={btn}>Withdraw this agreement</button></form>}
            {open && can(ctx.role, "contract.record_completion") && (
              <details className="mt-3"><summary className="flex min-h-10 cursor-pointer items-center text-sm font-semibold text-ink/70">Signed outside the app? Record it by hand</summary>
                <form action={completionAction} className="mt-2 space-y-2"><input type="hidden" name="id" value={k.id} />
                  <label className="label" htmlFor="ev">Where is the signed copy, and who signed?</label><textarea id="ev" name="evidence" className="field" required minLength={10} />
                  <button className={btn}>Record it</button><p className="text-sm text-ink/65">Recorded as completed by {ctx.name}. The app can't verify a signature made elsewhere.</p></form></details>
            )}
          </Panel>
        </div>

        <aside className="space-y-5">
          <Panel title="Payments" icon={CreditCard} tone="lilac">
            {k.billingIntents.length === 0 ? <p className="text-[15px] text-ink/70">Payments appear here once the agreement is signed.</p> : (
              <>
                <ul className="space-y-3">{k.billingIntents.map((b) => { const st = isScheduled(b) ? { label: "Due before launch", tone: "off" as const } : plainStatus(b.kind, b.status, b.cancelsAt, b.trialEndsAt); return (
                  <li key={b.id} className="rounded-xl border border-[#e3e7e3] bg-[#fafaf8] p-3">
                    <div className="flex items-start justify-between gap-3"><p className="font-semibold">{b.description ?? KIND_LABEL[b.kind] ?? b.kind}</p><p className="font-bold">{money(b.amountMinor, b.currency)}{isMonthly(b.kind) ? <span className="text-sm font-medium text-ink/60"> /mo</span> : ""}</p></div>
                    <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm"><span className={`rounded-md px-2 py-0.5 font-semibold ${TONE[st.tone]}`}>{st.label}</span>{b.paidAt && <span className="text-ink/65">{b.paidVia === "stripe" ? "by card" : "by bank or other"}</span>}</p>
                    {isMonthly(b.kind) && b.trialMonths > 0 && <p className="mt-1.5 text-[13px] font-semibold text-[#0a5a3d]">{b.promoLabel ?? "Offer"}: {b.trialMonths} month{b.trialMonths === 1 ? "" : "s"} free{b.trialEndsAt ? `, first payment ${fmtDate(b.trialEndsAt)}` : " from the day they start the plan"}</p>}
                    {!isMonthly(b.kind) && b.promoLabel && <p className="mt-1.5 text-[13px] font-semibold text-[#0a5a3d]">{b.promoLabel} applied to this fee</p>}
                    {receiptsBy.get(b.id)?.map((r) => <p key={r.id} className="mt-1.5 text-[13px]"><a className="font-semibold underline" href={`/api/receipts/${r.id}`} target="_blank" rel="noreferrer">Receipt {r.ref}</a> <span className="text-ink/65">· {fmtDate(r.paidAt)}</span></p>)}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {isMonthly(b.kind) && b.stripeSubscriptionId && ["active", "past_due"].includes(b.status) && !b.cancelsAt && <form action={cancelPlanAction}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="back" value={`/contracts/${k.id}`} /><button className={btn} title="Stops the monthly payments after the month they've already paid for">Cancel the monthly plan</button></form>}
                      {isScheduled(b) && <form action={requestFinalPaymentAction}><input type="hidden" name="contractId" value={k.id} /><input type="hidden" name="back" value={`/contracts/${k.id}`} /><button className={btn} title="Emails them and lets them pay. This also happens by itself when the project reaches Ready to launch.">Ask for the final payment now</button></form>}
                      {b.status === "pending" && !isMonthly(b.kind) && <form action={markPaidAction}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="back" value={`/contracts/${k.id}`} /><button className={btn}>Mark as paid (bank)</button></form>}
                      {isMonthly(b.kind) && b.status === "pending" && <details className="w-full rounded-lg border border-line bg-white px-3 py-1"><summary className="min-h-9 cursor-pointer py-1.5 text-[13px] font-semibold">{b.trialMonths > 0 ? "Change the free period" : "Give free months"}</summary>
                        <form action={setPlanOfferAction} className="mb-2 mt-1 flex flex-wrap items-end gap-2"><input type="hidden" name="id" value={b.id} /><input type="hidden" name="back" value={`/contracts/${k.id}`} />
                          <div><label className="label" htmlFor={`m-${b.id}`}>Free months</label><select id={`m-${b.id}`} name="months" className="field !min-h-10" defaultValue={String(b.trialMonths)}>{[0, 1, 2, 3, 6, 12].map((n) => <option key={n} value={n}>{n === 0 ? "None" : `${n} month${n === 1 ? "" : "s"}`}</option>)}</select></div>
                          <div><label className="label" htmlFor={`l-${b.id}`}>Called</label><input id={`l-${b.id}`} name="label" className="field !min-h-10" defaultValue={b.promoLabel ?? ""} placeholder="Launch offer" maxLength={60} /></div>
                          <button className={btn}>Save</button></form>
                        <p className="mb-2 text-[12.5px] text-ink/65">Only before they start the plan. They are taken through checkout as normal, their card is saved, and nothing is charged until the free months end.</p></details>}
                      {b.status === "pending" && <form action={cancelChargeAction}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="back" value={`/contracts/${k.id}`} /><button className={btn}>Cancel this charge</button></form>}
                    </div>
                  </li>); })}</ul>
                {k.billingIntents.some((b) => b.kind === "one_off" && b.status === "pending") && (
                  <form action={splitFeeAction} className="mt-4 flex flex-wrap items-end gap-2 border-t border-[#eceeec] pt-4"><input type="hidden" name="contractId" value={k.id} /><input type="hidden" name="back" value={`/contracts/${k.id}`} />
                    <div><label className="label" htmlFor="pct">Take a deposit of</label><select id="pct" name="percent" className="field" defaultValue="50">{[25, 30, 40, 50, 60].map((n) => <option key={n} value={n}>{n}% up front</option>)}</select></div>
                    <button className={btn}>Split the website fee</button></form>)}
                <p className="mt-3 text-sm text-ink/65">Customers pay by card from their portal. A website-only job simply has no monthly plan.</p>
              </>
            )}
          </Panel>
          {k.project && <Panel title="Project" icon={FolderKanban} tone="amber"><p className="font-semibold">{k.project.name}</p><p className="mt-1 text-sm text-ink/65">{k.project.reference}</p><Link className="btn btn-quiet !min-h-11 sm:!min-h-9 mt-3" href={`/projects/${k.project.id}`}>Open the project</Link></Panel>}
        </aside>
      </div>
    </>
  );
}
