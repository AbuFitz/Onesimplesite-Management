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
import { ProposalFields } from "@/components/proposal-fields";
import Link from "next/link";

export const metadata = { title: "Agreement" };
export default async function ProposalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string; sent?: string; existing?: string }> }) {
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
  ];
  const ready = checks.every(([, ok]) => ok);
  return (
    <>
      <RecordHeader back={{ href: "/agreements", label: "Agreements" }} title={p.title} status={<><Status label={p.status} kind={p.status === "accepted" ? "good" : "neutral"} />{opp && can(ctx.role, "opportunity.write") && <AutoSelect action={setTicketStageAction} name="stage" value={opp.stage} label="Where this ticket is up to" hidden={{ id: opp.id, version: String(opp.version), back: `/proposals/${p.id}` }} options={Object.entries(ONBOARDING_LABEL).map(([value, v]) => ({ value, label: v.label }))} />}</>} meta={<span>{p.reference} · version {cur.number}</span>} />
      <ErrorSummary message={sp.error} />
      {sp.existing && <p role="status" className="mb-4 text-sm text-moss">{p.customer.displayName} already has an agreement in progress, so we opened it rather than starting a second one.</p>}
      {sp.saved && <p role="status" className="mb-4 text-sm text-moss">Saved.</p>}
      {sp.sent && <p role="status" className="mb-4 text-sm text-moss">Agreement sent. The customer receives one email with the signing link.</p>}
      {contract && <p className="mb-4 text-sm"><Link className="underline" href={`/contracts/${contract.id}`}>Open signed copy and status ({contract.reference})</Link> ({contract.status.replace("_", " ")})</p>}
      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="ed">
          <h2 id="ed" className="mb-3">{editable ? "The agreement" : "Sent version (read-only)"}</h2>
          {editable ? (
            <form action={saveDraftAction} className="space-y-4"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="version" value={p.version} />
              <ProposalFields plans={(await db.servicePlan.findMany({ where: { workspaceId: ctx.workspaceId, active: true }, orderBy: [{ position: "asc" }, { name: "asc" }] })).map((x) => ({ id: x.id, name: x.name, price: `£${(x.monthlyMinor / 100).toFixed(2)}` }))} initial={{ title: p.title, scope: cur.scope, terms: cur.terms, validUntil: cur.validUntil, recurringPeriod: cur.recurringPeriod, lines: cur.lines, requirements: cur.requirements as Record<string, string | undefined> | null }} />
              <button className="btn btn-quiet">Save changes</button></form>
          ) : <div className="whitespace-pre-wrap text-sm">{cur.scope}</div>}
        </section>
        <section aria-labelledby="pv" className="space-y-6">
          <div><h2 id="pv" className="mb-2">Price</h2>
            <p>One-off: <strong>{money(cur.oneOffMinor)}</strong></p>
            <p>Recurring: <strong>{money(cur.recurringMinor)}</strong>{cur.recurringPeriod ? ` / ${cur.recurringPeriod}` : ""}</p>
            <p className="hint">Valid until {cur.validUntil ? fmtDateTime(cur.validUntil) : "set when sent (30 days)"}</p></div>
          {editable && can(ctx.role, "proposal.send") && (
            <form action={sendAgreementAction} className="space-y-3 border-t border-line pt-4"><input type="hidden" name="id" value={p.id} />
              <h2>Send for signature</h2>
              <p className="text-sm"><Link className="btn btn-quiet" href={`/proposals/${p.id}/preview`}>Preview what they will see</Link> <a className="ml-2 text-sm underline" href={`/proposals/${p.id}/preview/pdf`} target="_blank" rel="noreferrer">PDF preview</a></p>
              <ul className="text-sm">{checks.map(([label, ok, href]) => <li key={label} className="py-0.5"><Status label={ok ? "ready" : "needed"} kind={ok ? "good" : "warn"} /> {label}{!ok && <> · <Link className="underline" href={href}>fix</Link></>}</li>)}</ul>
              <label className="label" htmlFor="sn">Signer name</label><input id="sn" name="name" className="field" defaultValue={primary?.name} required />
              <label className="label" htmlFor="to">Signer email (check carefully)</label><input id="to" name="email" type="email" className="field" defaultValue={primary?.email ?? ""} required />
              <p className="hint">The customer gets one email and one page showing the order, your website requirements, the price and our Services Agreement. Signing it is their acceptance. Version {cur.number} is frozen when you send; changes need a new version.</p>
              <button className="btn" disabled={!ready}>Send for signature</button></form>
          )}
          {p.status === "sent" && can(ctx.role, "proposal.write") && (
            <form action={reviseProposalAction}><input type="hidden" name="id" value={p.id} />
              <p className="hint mb-2">Revising creates version {cur.number + 1}, withdraws the current link and requires the client to accept again.</p>
              <button className="btn btn-quiet">Create new version</button></form>
          )}
          {cur.acceptances[0] && <p className="text-sm">Accepted by {cur.acceptances[0].acceptedName} ({cur.acceptances[0].acceptedEmail}) on {fmtDateTime(cur.acceptances[0].acceptedAt)}. Wording version {cur.acceptances[0].termsVersion}.</p>}
        </section>
      </div>
    </>
  );
}
