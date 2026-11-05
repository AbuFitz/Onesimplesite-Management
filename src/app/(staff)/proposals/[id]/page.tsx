import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { saveDraftAction, sendAgreementAction, reviseProposalAction } from "@/app/actions/crm";
import { getCompany, companyMissing } from "@/modules/settings/service";
import { documentValues } from "@/modules/settings/plans";
import { emptyVars, labelFor } from "@/modules/settings/variables";
import { customerDetailsMissing } from "@/modules/crm/service";
import { AutoSelect } from "@/components/auto-form";
import { setTicketStageAction } from "@/app/actions/crm";
import { ONBOARDING_LABEL } from "@/modules/support/options";
import { RecordHeader, Status, ErrorSummary, money, fmtDateTime } from "@/components/ui";
import { ProposalFields, STEPS } from "@/components/proposal-fields";
import Link from "next/link";
import { promoFrom } from "@/modules/billing/promo";

export const metadata = { title: "Agreement" };
export default async function ProposalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string; sent?: string; existing?: string; step?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const { id } = await params;
  const sp = await searchParams;
  const p = await db.proposal.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: { customer: { include: { contacts: true } }, versions: { orderBy: { number: "desc" }, include: { lines: { orderBy: { position: "asc" } }, acceptances: true } } } });
  if (!p) notFound();
  const cur = p.versions.find((v) => v.number === p.currentVersion)!;
  const editable = p.status === "draft";
  const opp = p.opportunityId ? await db.opportunity.findFirst({ where: { id: p.opportunityId, workspaceId: ctx.workspaceId }, select: { id: true, stage: true, version: true } }) : null;
  const contract = await db.contract.findFirst({ where: { workspaceId: ctx.workspaceId, proposalVersionId: { in: p.versions.map((v) => v.id) } } });
  const primary = p.customer.contacts.find((c) => c.isPrimary) ?? p.customer.contacts[0];
  const company = await getCompany(ctx);
  const published = await db.termsVersion.findFirst({ where: { workspaceId: ctx.workspaceId, kind: "terms", status: "published" } });
  const planId = (cur.requirements as Record<string, string | undefined> | null)?.plan;
  const [sla, hosting] = planId ? await Promise.all(["sla", "hosting"].map((kind) => db.termsVersion.findFirst({ where: { workspaceId: ctx.workspaceId, kind, status: "published" } }))) : [null, null];
  const draftOk = process.env.ALLOW_DRAFT_TERMS === "true";
  const vars = await documentValues(ctx.workspaceId, planId);
  const needed = emptyVars([published?.body, sla?.body, hosting?.body].filter(Boolean).join("\n"), vars).map(labelFor);
  const checks: [string, boolean, string][] = [
    ["Our company details", companyMissing(company).length === 0, "/settings"],
    [`${p.customer.displayName}'s details`, customerDetailsMissing(p.customer).length === 0, `/customers/${p.customerId}/details`],
    ["Published Services Agreement", !!published || draftOk, "/settings/legal/terms"],
    ...(planId ? ([["Published Service Level Agreement", !!sla || draftOk, "/settings/legal/sla"], ["Published Hosting and Care Plan Terms", !!hosting || draftOk, "/settings/legal/hosting"]] as [string, boolean, string][]) : []),
    ["Plan and contact details filled in", needed.length === 0, "/settings/plans"],
    ...(Number((cur.requirements as Record<string, string | undefined> | null)?.promoFreeMonths) > 0 && cur.recurringMinor <= 0 ? ([["A care plan for the free months to apply to (pick one under Price)", false, `/proposals/${p.id}`]] as [string, boolean, string][]) : []),
  ];
  const ready = checks.every(([, ok]) => ok);
  const req = (cur.requirements ?? {}) as Record<string, string | undefined>;
  const pr = promoFrom(req, cur.oneOffMinor);
  const fee = Math.max(0, cur.oneOffMinor - (pr?.discountMinor ?? 0));
  const depPct = Number(req.depositPercent) || 0, dep = depPct > 0 ? Math.round((fee * depPct) / 100) : 0;
  const step = Math.min(5, Math.max(1, Number(sp.step) || 1));
  const priceLines = (<>
    <p>One-off: <strong>{money(cur.oneOffMinor)}</strong></p>
    {pr?.endsAfter && cur.recurringMinor > 0
      ? <p>Recurring: <strong>£0.00</strong> <span className="text-sm text-muted">free for {pr.freeMonths} month{pr.freeMonths === 1 ? "" : "s"}, then it ends. {money(cur.recurringMinor)} / {cur.recurringPeriod ?? "month"} only if they ask to continue.</span></p>
      : <p>Recurring: <strong>{money(cur.recurringMinor)}</strong>{cur.recurringPeriod ? ` / ${cur.recurringPeriod}` : ""}</p>}
  </>);
  const plans = editable ? (await db.servicePlan.findMany({ where: { workspaceId: ctx.workspaceId, active: true }, orderBy: [{ position: "asc" }, { name: "asc" }] })).map((x) => ({ id: x.id, name: x.name, price: `£${(x.monthlyMinor / 100).toFixed(2)}`, monthlyMinor: x.monthlyMinor })) : [];
  const stepper = (interactive: boolean) => (
    <ol aria-label="Steps" className="mb-6 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
      {STEPS.map((x) => {
        const state = x.n === step ? "current" : x.n < step ? "done" : "todo";
        const cls = `flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold ${state === "current" ? "border-ink bg-ink text-white" : state === "done" ? "border-[#bfe3d2] bg-[#eef9f3] text-[#0a5a3d]" : "border-line bg-white text-ink"}`;
        const inner = <><span className={`grid size-6 place-items-center rounded-full text-xs ${state === "current" ? "bg-white text-ink" : state === "done" ? "bg-[#0a5a3d] text-white" : "bg-bone"}`}>{state === "done" ? "✓" : x.n}</span>{x.name}</>;
        return <li key={x.n}>{interactive ? <button type="submit" name="go" value={x.n} formNoValidate aria-current={state === "current" ? "step" : undefined} className={cls}>{inner}</button> : <Link href={`/proposals/${p.id}?step=${x.n}`} aria-current={state === "current" ? "step" : undefined} className={cls}>{inner}</Link>}</li>;
      })}
    </ol>
  );
  const summaryCard = (n: number, title: string, children: React.ReactNode) => (
    <section className="rounded-2xl border border-line bg-white p-4"><div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-base font-bold">{title}</h3><Link href={`/proposals/${p.id}?step=${n}`} className="text-sm font-semibold underline">Change</Link></div>{children}</section>
  );
  const filledReqs = Object.entries(req).filter(([k, v]) => v && ["pages", "features", "integrations", "domainHosting", "contentBy", "timeline", "payment", "notes"].includes(k)).length;
  const wizard = !editable ? null : step < 5 ? (
    <form action={saveDraftAction} className="mx-auto max-w-3xl"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="version" value={p.version} /><input type="hidden" name="from" value={step} />
      <button type="submit" name="go" value={step + 1} hidden aria-hidden tabIndex={-1} />
      {stepper(true)}
      <ProposalFields step={step} plans={plans} initial={{ title: p.title, scope: cur.scope, terms: cur.terms, validUntil: cur.validUntil, recurringPeriod: cur.recurringPeriod, lines: cur.lines.map((l) => ({ description: l.description, quantity: l.quantity, unitMinor: l.unitMinor, recurring: l.recurring })), requirements: cur.requirements as Record<string, string | undefined> | null }} />
      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-5">
        {step > 1 && <button type="submit" name="go" value={step - 1} formNoValidate className="btn btn-quiet">Back</button>}
        <button type="submit" name="go" value={step + 1} className="btn">{step === 4 ? "Save and review" : "Save and continue"}</button>
        <span className="text-sm text-muted">Step {step} of 5. Everything is saved when you continue.</span>
      </div>
    </form>
  ) : (
    <div className="mx-auto max-w-3xl space-y-4">
      {stepper(false)}
      <h2 className="text-xl">Step 5: Check and send</h2><p className="mb-1 text-[15px] text-muted">{STEPS[4].help}</p>
      {summaryCard(1, "The job", <><p className="font-semibold">{p.title}</p><p className="text-sm text-muted">{cur.scope}</p></>)}
      {summaryCard(2, "Price", <>{priceLines}<ul className="mt-1 text-sm text-muted">{cur.lines.map((l) => <li key={l.id}>{l.description}: {money(l.unitMinor * l.quantity)}{l.recurring ? " a month" : ""}</li>)}</ul></>)}
      {summaryCard(3, "Payment and offer", <ul className="space-y-1 text-[15px]">
        <li>{depPct > 0 ? <>Deposit <strong>{money(dep)}</strong> ({depPct}%) when they sign, then <strong>{money(fee - dep)}</strong> before the site goes live.</> : <>No deposit. {fee > 0 ? <>The website fee of <strong>{money(fee)}</strong> is due after they sign.</> : "Nothing is due for the website."}</>}</li>
        <li>{pr ? <>Offer “{pr.label}”: {[pr.discountMinor > 0 ? `${money(pr.discountMinor)} off the website fee` : "", pr.freeMonths > 0 ? (pr.endsAfter ? `${pr.freeMonths} free month${pr.freeMonths === 1 ? "" : "s"} of care that simply end` : `${pr.freeMonths} free month${pr.freeMonths === 1 ? "" : "s"} on the care plan`) : ""].filter(Boolean).join(" and ")}.</> : "No offer."}</li>
      </ul>)}
      {summaryCard(4, "Details", <p className="text-[15px]">{filledReqs > 0 ? `${filledReqs} detail${filledReqs === 1 ? "" : "s"} filled in.` : "None added. You can still send it."}{cur.validUntil ? ` Open until ${fmtDateTime(cur.validUntil)}.` : " Open for 30 days once sent."}</p>)}
      <section className="rounded-2xl border border-line bg-bone/50 p-4">
        <h3 className="mb-1 text-base font-bold">See it as they will</h3>
        <p className="mb-3 text-sm text-muted">Nothing is sent when you preview.</p>
        <div className="flex flex-wrap items-center gap-3"><Link className="btn" href={`/proposals/${p.id}/preview`}>Preview what they will see</Link><a className="text-sm underline" href={`/proposals/${p.id}/preview/pdf`} target="_blank" rel="noreferrer">PDF preview</a></div>
      </section>
      {can(ctx.role, "proposal.send") && (
        <form action={sendAgreementAction} id="send" className="space-y-3 rounded-2xl border-2 border-ink p-4"><input type="hidden" name="id" value={p.id} />
          <h3 className="text-base font-bold">Send for signature</h3>
          <ul className="text-sm">{checks.map(([label, ok, href]) => <li key={label} className="py-0.5"><Status label={ok ? "ready" : "needed"} kind={ok ? "good" : "warn"} /> {label}{!ok && <> · <Link className="underline" href={href}>fix</Link></>}</li>)}</ul>
          <label className="label" htmlFor="sn">Who signs? Their name</label><input id="sn" name="name" className="field" defaultValue={primary?.name} required />
          <label className="label" htmlFor="to">Their email (check it carefully)</label><input id="to" name="email" type="email" className="field" defaultValue={primary?.email ?? ""} required />
          <p className="hint">They get one email with one page showing the agreement and our terms. Signing it is their acceptance. Once sent it is frozen: a change means a new version.</p>
          <button className="btn" disabled={!ready}>Send for signature</button>
          {!ready && <p className="text-sm font-semibold text-[#7a2e12]">Fix the "needed" items above first. Then you can send.</p>}</form>
      )}
    </div>
  );
  return (
    <>
      <RecordHeader back={{ href: "/agreements", label: "Agreements" }} title={p.title} status={<><Status label={p.status === "draft" ? "Being written" : p.status === "sent" ? "Waiting for signature" : p.status === "accepted" ? "Signed" : p.status} kind={p.status === "accepted" ? "good" : p.status === "sent" ? "warn" : "neutral"} />{p.status !== "draft" && opp && can(ctx.role, "opportunity.write") && <AutoSelect action={setTicketStageAction} name="stage" value={opp.stage} label="Where this deal is up to" hidden={{ id: opp.id, version: String(opp.version), back: `/proposals/${p.id}` }} options={Object.entries(ONBOARDING_LABEL).map(([value, v]) => ({ value, label: v.label }))} />}</>} meta={<span><Link className="underline" href={`/customers/${p.customerId}`}>{p.customer.displayName}</Link> · {p.reference} · version {cur.number}</span>} />
      <ErrorSummary message={sp.error} />
      {sp.existing && <p role="status" className="mb-4 text-sm text-moss">{p.customer.displayName} already has an agreement in progress, so we opened it rather than starting a second one.</p>}
      {sp.saved && <p role="status" className="mb-4 text-sm text-moss">Saved.</p>}
      {sp.sent && <p role="status" className="mb-4 text-sm text-moss">Agreement sent. The customer receives one email with the signing link.</p>}
      {contract && <p className="mb-4 flex flex-wrap items-center gap-3 text-sm"><Link className="btn" href={`/contracts/${contract.id}/document`}>View the agreement as sent</Link><Link className="underline" href={`/contracts/${contract.id}`}>Status and signed copy ({contract.reference}, {contract.status.replace("_", " ")})</Link></p>}
      {editable ? wizard : (
        <div className="grid gap-10 lg:grid-cols-2">
          <section aria-labelledby="ed"><h2 id="ed" className="mb-3">Sent version (read-only)</h2><div className="whitespace-pre-wrap text-sm">{cur.scope}</div></section>
          <section aria-labelledby="pv" className="space-y-6">
            <div><h2 id="pv" className="mb-2">Price</h2>{priceLines}<p className="hint">Valid until {cur.validUntil ? fmtDateTime(cur.validUntil) : "set when sent (30 days)"}</p></div>
            {p.status === "sent" && can(ctx.role, "proposal.write") && (
              <form action={reviseProposalAction}><input type="hidden" name="id" value={p.id} />
                <p className="hint mb-2">Revising creates version {cur.number + 1}, withdraws the current link and requires the client to accept again.</p>
                <button className="btn btn-quiet">Create new version</button></form>
            )}
            {cur.acceptances[0] && <p className="text-sm">Accepted by {cur.acceptances[0].acceptedName} ({cur.acceptances[0].acceptedEmail}) on {fmtDateTime(cur.acceptances[0].acceptedAt)}. Wording version {cur.acceptances[0].termsVersion}.</p>}
          </section>
        </div>
      )}
    </>
  );
}
