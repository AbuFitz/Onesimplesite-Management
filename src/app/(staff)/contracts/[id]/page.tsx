import { plainStatus, KIND_LABEL, isMonthly, isScheduled, scheduledLabel } from "@/modules/billing/service";
import { Timeline } from "@/components/timeline";
import { emailPaymentLinkAction, startCarePlanAction, continueFreePlanAction, requestFinalPaymentAction, markPaidAction, cancelChargeAction, splitFeeAction, cancelPlanAction, setPlanOfferAction } from "@/app/actions/billing";
import { notFound } from "next/navigation";
import Link from "next/link";
import { promoFrom } from "@/modules/billing/promo";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { sendForSigningAction, voidSigningAction, completionAction, reviseProposalAction, cancelOrderAction } from "@/app/actions/crm";
import { RecordHeader, Status, ErrorSummary, money, fmtDateTime, fmtDate } from "@/components/ui";
import { Panel, SummaryTile, FactRow } from "@/components/panel";
import { FileText, PenLine, CreditCard, FolderKanban, History, Download, CheckCircle2 } from "lucide-react";

export const metadata = { title: "Contract" };
export default async function ContractPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; sent?: string; emailed?: string; cancelled?: string; paid?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const { id } = await params;
  const sp = await searchParams;
  const k = await db.contract.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { customer: { include: { contacts: { where: { isPrimary: true }, take: 1 } } }, project: true, billingIntents: true, proposalVersion: { select: { proposalId: true, number: true, requirements: true, proposal: { select: { status: true } } } }, signingRequests: { orderBy: { createdAt: "desc" }, include: { signature: true } }, documents: { select: { sha256: true, createdAt: true } } },
  });
  if (!k) notFound();
  const pc = k.customer.contacts[0];
  const events = await db.auditEvent.findMany({ where: { workspaceId: ctx.workspaceId, targetId: { in: [k.id, ...(k.proposalVersion?.proposalId ? [k.proposalVersion.proposalId] : [])] } }, orderBy: { createdAt: "desc" }, take: 60, select: { id: true, action: true, actorLabel: true, createdAt: true } });
  const receiptsBy = new Map<string, { id: string; ref: string; paidAt: Date }[]>();
  for (const r of await db.receipt.findMany({ where: { intentId: { in: k.billingIntents.map((b) => b.id) } }, orderBy: { paidAt: "asc" }, select: { id: true, ref: true, paidAt: true, intentId: true } })) receiptsBy.set(r.intentId, [...(receiptsBy.get(r.intentId) ?? []), r]);
  const live = k.signingRequests.find((r) => r.status === "pending");
  const open = k.status === "draft" || k.status === "awaiting_signature";
  const TONE = { due: "bg-[#f8ecbf] text-[#5c4700]", ok: "bg-[#d7f3e6] text-[#0a5a3d]", warn: "bg-[#fbdccf] text-[#7a2e12]", off: "bg-[#ebe9e1] text-ink/70" } as const;
  const stateTone = k.cancelledAt ? "rose" : k.status === "completed" ? "green" : k.status === "declined" || k.status === "voided" ? "rose" : "amber";
  const stateText = k.cancelledAt ? "Cancelled" : ({ completed: "Signed", awaiting_signature: "Waiting to sign", draft: "Not sent yet", declined: "Declined", voided: "Withdrawn" } as Record<string, string>)[k.status] ?? k.status.replaceAll("_", " ");
  const btn = "btn btn-quiet !min-h-11 sm:!min-h-9";
  const offer = promoFrom((k.proposalVersion?.requirements ?? {}) as Record<string, string | undefined>, k.oneOffMinor);
  const freeEnds = !!(offer?.endsAfter && k.recurringMinor > 0);
  // ---- What needs doing next, in one sentence with one main action; and the order's journey from sent to care plan.
  const viewed = events.find((e) => e.action === "signing.viewed");
  const signer = k.signingRequests.find((r) => r.status === "pending") ?? k.signingRequests[0];
  const deposit = k.billingIntents.find((b) => ["deposit", "one_off"].includes(b.kind));
  const balance = k.billingIntents.find((b) => b.kind === "balance");
  const care = k.billingIntents.find((b) => b.kind === "recurring_setup");
  const duePay = k.billingIntents.find((b) => b.status === "pending" && !isScheduled(b) && !isMonthly(b.kind));
  type Next = { tone: "go" | "wait" | "done" | "stop"; title: string; text: string; cta?: { label: string; href?: string; form?: "email"; id?: string } };
  const next: Next = k.cancelledAt ? { tone: "stop", title: "This order was cancelled", text: "Unpaid charges were cancelled and the project stopped. The signed copy stays on record." }
    : k.status === "declined" || k.status === "voided" ? { tone: "stop", title: k.status === "declined" ? "The customer declined" : "This agreement was withdrawn", text: k.status === "declined" ? "You can change it and send a new version." : "Nothing is waiting on anyone." }
    : k.status === "draft" || (open && !live) ? { tone: "go", title: "Ready to send for signature", text: "The customer gets one email with one signature to make.", cta: { label: "Send for signature", href: "#send" } }
    : open && live ? { tone: "wait", title: `Waiting for ${signer?.signerName ?? "the customer"} to sign`, text: viewed ? `They opened it ${fmtDateTime(viewed.createdAt)} but have not signed yet.` : "They have not opened the link yet. A nudge by phone or a fresh link can help.", cta: { label: "Send a fresh link", href: "#send" } }
    : duePay ? { tone: "go", title: `${duePay.kind === "deposit" ? "Deposit" : "Payment"} of ${money(duePay.amountMinor, duePay.currency)} is waiting`, text: "Customers pay by card from their portal. Email them the link if they have not.", cta: { label: "Email them the payment link", form: "email", id: duePay.id } }
    : balance && isScheduled(balance) ? { tone: "wait", title: "Building the site", text: "The final payment is asked for automatically when the project reaches Ready to launch." }
    : { tone: "done", title: "Nothing needs you right now", text: "Signed, paid up to date, and the project is running." };
  type JStep = { key: string; title: string; note: string; state: "done" | "here" | "todo" };
  const jstate = (done: boolean, here: boolean): JStep["state"] => (done ? "done" : here ? "here" : "todo");
  const sentAt = k.signingRequests[k.signingRequests.length - 1]?.createdAt;
  const journey: JStep[] = k.status === "declined" || k.status === "voided" ? [] : [
    { key: "sent", title: "Sent", note: sentAt ? fmtDate(sentAt) : "Not yet", state: jstate(!!sentAt, !sentAt) },
    { key: "opened", title: "Opened", note: viewed ? fmtDate(viewed.createdAt) : "Not yet", state: jstate(!!viewed || k.status === "completed", !!sentAt && !viewed && k.status !== "completed") },
    { key: "signed", title: "Signed", note: k.completedAt ? fmtDate(k.completedAt) : "Waiting", state: jstate(k.status === "completed", !!viewed && k.status !== "completed") },
    ...(deposit ? [{ key: "dep", title: deposit.kind === "deposit" ? "Deposit" : "Website fee", note: deposit.status === "paid" ? "Paid" : deposit.paidVia === "free" ? "Free" : "Due on signing", state: jstate(deposit.status === "paid", k.status === "completed" && deposit.status !== "paid") }] : []),
    ...(balance ? [{ key: "bal", title: "Final payment", note: balance.status === "paid" ? "Paid" : "Before launch", state: jstate(balance.status === "paid", k.status === "completed" && deposit?.status === "paid" && balance.status !== "paid") }] : []),
    ...(care ? [{ key: "care", title: "Care plan", note: care.paidVia === "free" ? "Free months" : care.status === "active" ? "Running" : "Starts at launch", state: jstate(care.status === "active" || care.paidVia === "free" && care.status !== "pending", false) }] : []),
  ];

  return (
    <>
      <RecordHeader back={{ href: `/customers/${k.customerId}`, label: k.customer.displayName }} title={k.title} status={<Status label={stateText} kind={k.cancelledAt ? "bad" : k.status === "completed" ? "good" : k.status === "declined" || k.status === "voided" ? "bad" : "warn"} />} meta={<span>{k.reference}</span>} />
      <ErrorSummary message={sp.error} />
      {sp.cancelled && <p role="status" className="mb-4 rounded-lg bg-[#fbf3d5] px-4 py-3 text-sm font-semibold text-[#5c4700]">Order cancelled. {sp.cancelled} unpaid charge{sp.cancelled === "1" ? "" : "s"} cancelled, the deal is marked lost and the project is cancelled.{Number(sp.paid) > 0 ? ` ${money(Number(sp.paid))} had already been paid. Refund it in Stripe if it should go back.` : ""}</p>}
      {sp.emailed && <p role="status" className="mb-4 rounded-lg bg-[#d7f3e6] px-4 py-3 text-sm font-semibold text-[#0a5a3d]">Payment link emailed to {sp.emailed}.</p>}
      {sp.sent && <p role="status" className="mb-4 rounded-lg bg-[#d7f3e6] px-4 py-3 text-sm font-semibold text-[#0a5a3d]">Signing email on its way.</p>}

      <section className={`nx-next ${next.tone}`} aria-label="What happens next">
        <p className="nx-eye">{next.tone === "done" ? "All good" : next.tone === "stop" ? "Closed" : "Next"}</p>
        <h2>{next.title}</h2>
        <p>{next.text}</p>
        {next.cta && (next.cta.form === "email"
          ? <form action={emailPaymentLinkAction}><input type="hidden" name="id" value={next.cta.id} /><input type="hidden" name="back" value={`/contracts/${k.id}`} /><button className="nx-cta">{next.cta.label}</button></form>
          : <a className="nx-cta" href={next.cta.href}>{next.cta.label}</a>)}
      </section>
      {journey.length > 1 && (
        <section className="card p-5 sm:p-6 mb-5" aria-label="The order, step by step">
          <ol className="flow">{journey.map((j) => (
            <li key={j.key} className={`flow-s ${j.state === "done" ? "paid" : j.state === "here" ? "due here" : "later"}`}>
              <span className="flow-dot" aria-hidden>{j.state === "done" ? <CheckCircle2 size={18} /> : journey.indexOf(j) + 1}</span>
              <div className="flow-card"><b>{j.title}</b><span /><small>{j.note}</small></div>
            </li>))}</ol>
        </section>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile label="Status" value={stateText} sub={k.completedAt ? fmtDate(k.completedAt) : undefined} tone={stateTone} />
        <SummaryTile label="Website" value={money(k.oneOffMinor, k.currency)} sub="one-off" tone="blue" />
        <SummaryTile label="Monthly plan" value={k.recurringMinor ? (freeEnds ? "Free" : money(k.recurringMinor, k.currency)) : "None"} sub={k.recurringMinor ? (freeEnds ? `${offer!.freeMonths} month${offer!.freeMonths === 1 ? "" : "s"}, then it ends` : "every month") : "website only"} tone="lilac" />
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
            {k.status === "awaiting_signature" && k.proposalVersion?.proposal.status === "sent" && can(ctx.role, "proposal.write") && (
              <form action={reviseProposalAction} className="mt-4 rounded-xl border border-line bg-white p-4"><input type="hidden" name="id" value={k.proposalVersion.proposalId} />
                <h3 className="text-[15px] font-bold">Need to change something?</h3>
                <p className="mt-1 text-sm text-ink/65">Price, deposit, offer, care plan or wording. This withdraws the link they have and opens the agreement for editing as version {k.proposalVersion.number + 1}. Preview it, then send it, and they sign the new one.</p>
                <button className="btn mt-3">Change it and send a new version</button></form>
            )}
            {open && can(ctx.role, "contract.send") && (
              <form action={sendForSigningAction} id="send" className="send-box mt-4 space-y-2"><input type="hidden" name="id" value={k.id} />
                <h3 className="text-[15px] font-bold">{live ? "Send a fresh signing link" : "Send for signature"}</h3>
                <div className="grid gap-3 sm:grid-cols-2"><div><label className="label" htmlFor="sn">Signer name</label><input id="sn" name="name" className="field" defaultValue={pc?.name} required /></div>
                  <div><label className="label" htmlFor="se">Signer email</label><input id="se" name="email" type="email" className="field" defaultValue={pc?.email ?? ""} required /></div></div>
                <button className="btn">{live ? "Resend the same agreement with a fresh link" : "Send for signature"}</button>
                <p className="text-sm text-ink/65">One email, one signature. The link is personal, works once and expires in 14 days. Check the email address carefully.</p></form>
            )}
            {k.status === "completed" && !k.cancelledAt && can(ctx.role, "contract.void") && (
              <details className="mt-4 rounded-xl border border-[#f1d3c8] bg-[#fff8f5] p-3">
                <summary className="flex min-h-10 cursor-pointer items-center text-sm font-semibold text-[#7a2e12]">Cancel this order</summary>
                <form action={cancelOrderAction} className="mt-2 space-y-2"><input type="hidden" name="id" value={k.id} />
                  <p className="text-sm text-ink/70">Use this if the customer has pulled out after signing. It cancels every unpaid charge and any free care period, marks the deal lost and cancels the project. The signed copy stays on record, and anything already paid is not refunded here (do that in Stripe). It cannot be used once the site is live.</p>
                  <label className="label" htmlFor="cr">Why is it being cancelled?</label><input id="cr" name="reason" className="field" required minLength={3} maxLength={300} placeholder="e.g. Customer changed their mind" />
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" name="sure" className="size-4 accent-[#7a2e12]" /> I'm sure, cancel the whole order</label>
                  <button className="btn btn-quiet !border-[#e0b3a2] !text-[#7a2e12]">Cancel the order</button></form>
              </details>
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
                <ul className="space-y-3">{k.billingIntents.map((b) => { const st = isScheduled(b) ? { label: scheduledLabel(b), tone: "off" as const } : plainStatus(b.kind, b.status, b.cancelsAt, b.trialEndsAt, b.paidVia === "free"); return (
                  <li key={b.id} className="pay-card">
                    <div className="pay-top"><div className="min-w-0"><p className="pay-t">{b.description ?? KIND_LABEL[b.kind] ?? b.kind}</p>
                      <p className="pay-s"><span className={`chg-status ${TONE[st.tone]}`}>{st.label}</span>{b.paidAt && <span>{b.paidVia === "stripe" ? "by card" : "by bank or other"}</span>}</p></div>
                      <p className="pay-a num">{b.paidVia === "free" ? "Free" : money(b.amountMinor, b.currency)}{isMonthly(b.kind) && b.paidVia !== "free" ? <span> /mo</span> : ""}</p></div>
                    {b.paidVia === "free" && <p className="pay-note">{b.promoLabel ?? "Offer"}: no card needed. Nothing is ever charged, and it ends {b.trialEndsAt ? fmtDate(b.trialEndsAt) : "when the free months end"}. You get a reminder a week before.</p>}
                    {isMonthly(b.kind) && b.paidVia !== "free" && b.trialMonths > 0 && <p className="pay-note">{b.promoLabel ?? "Offer"}: {b.trialMonths} month{b.trialMonths === 1 ? "" : "s"} free{b.trialEndsAt ? `, first payment ${fmtDate(b.trialEndsAt)}` : " from the day they start the plan"}</p>}
                    {!isMonthly(b.kind) && b.promoLabel && <p className="pay-note">{b.promoLabel} applied to this fee</p>}
                    {receiptsBy.get(b.id)?.map((r) => <p key={r.id} className="pay-rc"><a href={`/api/receipts/${r.id}`} target="_blank" rel="noreferrer">Receipt {r.ref}</a> · {fmtDate(r.paidAt)}</p>)}
                    {(() => {
                      const back = `/contracts/${k.id}`;
                      const hid = <><input type="hidden" name="id" value={b.id} /><input type="hidden" name="back" value={back} /></>;
                      const hidC = <><input type="hidden" name="contractId" value={k.id} /><input type="hidden" name="back" value={back} /></>;
                      // One main action for this charge, chosen by where it is; everything else sits under "More".
                      const primary = isScheduled(b) && b.kind === "balance" ? <form action={requestFinalPaymentAction}>{hidC}<button className="pay-main" title="Emails them and lets them pay. This also happens by itself when the project reaches Ready to launch.">Ask for the final payment now</button></form>
                        : isScheduled(b) && b.kind === "recurring_setup" ? <form action={startCarePlanAction}>{hidC}<button className="pay-main" title="Starts the care plan now instead of waiting for the site to go live. A free care period starts counting from today.">{b.paidVia === "free" ? "Start the free month now" : "Open the care plan now"}</button></form>
                        : b.status === "pending" && !isScheduled(b) && b.contractId ? <form action={emailPaymentLinkAction}>{hid}<button className="pay-main" title="Sends them an email with a button to your portal, where they press Pay now. Safe to send again.">Email them the payment link</button></form> : null;
                      const more = [
                        b.paidVia === "free" ? <form key="cont" action={continueFreePlanAction}>{hid}<button className="pay-more-b" title="They want to carry on after the free months. It becomes a normal monthly plan that they start with a card in their portal.">They want to continue as a paid plan</button></form> : null,
                        isMonthly(b.kind) && b.stripeSubscriptionId && ["active", "past_due"].includes(b.status) && !b.cancelsAt ? <form key="plan" action={cancelPlanAction}>{hid}<button className="pay-more-b" title="Stops the monthly payments after the month they've already paid for">Cancel the monthly plan</button></form> : null,
                        b.status === "pending" && !isMonthly(b.kind) ? <form key="paid" action={markPaidAction}>{hid}<button className="pay-more-b">Mark as paid (bank)</button></form> : null,
                        b.status === "pending" && !isScheduled(b) && b.contractId && primary === null ? null : null,
                        b.status === "pending" ? <form key="cx" action={cancelChargeAction}>{hid}<button className="pay-more-b danger">Cancel this charge</button></form> : null,
                      ].filter(Boolean);
                      const offer = isMonthly(b.kind) && b.status === "pending" ? (
                        <details key="offer" className="pay-offer"><summary>{b.trialMonths > 0 ? "Change the free period" : "Give free months"}</summary>
                          <form action={setPlanOfferAction} className="pay-offer-f"><input type="hidden" name="id" value={b.id} /><input type="hidden" name="back" value={back} />
                            <div><label className="label" htmlFor={`m-${b.id}`}>Free months</label><select id={`m-${b.id}`} name="months" className="field !min-h-10" defaultValue={String(b.trialMonths)}>{[0, 1, 2, 3, 6, 12].map((n) => <option key={n} value={n}>{n === 0 ? "None" : `${n} month${n === 1 ? "" : "s"}`}</option>)}</select></div>
                            <div><label className="label" htmlFor={`l-${b.id}`}>Called</label><input id={`l-${b.id}`} name="label" className="field !min-h-10" defaultValue={b.promoLabel ?? ""} placeholder="Launch offer" maxLength={60} /></div>
                            <button className="pay-main">Save</button></form>
                          <p className="pay-note">Only before they start the plan. They are taken through checkout as normal, their card is saved, and nothing is charged until the free months end.</p></details>) : null;
                      return (<>{primary}{(more.length > 0 || offer) && <details className="pay-menu"><summary>More</summary><div>{more}{offer}</div></details>}</>);
                    })()}
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
          <Panel title="Timeline" icon={History} tone="amber"><Timeline events={events} empty="Nothing has happened to this agreement yet." /></Panel>
        </aside>
      </div>
    </>
  );
}
