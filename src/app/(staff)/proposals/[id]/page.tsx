import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { saveDraftAction, sendProposalAction, reviseProposalAction } from "@/app/actions/crm";
import { RecordHeader, Status, ErrorSummary, money, fmtDateTime } from "@/components/ui";
import { ProposalFields } from "@/components/proposal-fields";
import Link from "next/link";

export const metadata = { title: "Proposal" };
export default async function ProposalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string; sent?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const { id } = await params;
  const sp = await searchParams;
  const p = await db.proposal.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: { customer: { include: { contacts: true } }, versions: { orderBy: { number: "desc" }, include: { lines: { orderBy: { position: "asc" } }, acceptances: true } } } });
  if (!p) notFound();
  const cur = p.versions.find((v) => v.number === p.currentVersion)!;
  const editable = p.status === "draft";
  const contract = await db.contract.findFirst({ where: { workspaceId: ctx.workspaceId, proposalVersionId: { in: p.versions.map((v) => v.id) } } });
  const email = p.customer.contacts.find((c) => c.isPrimary)?.email ?? "";
  return (
    <>
      <RecordHeader back={{ href: `/customers/${p.customerId}`, label: p.customer.displayName }} title={p.title} status={<Status label={p.status} kind={p.status === "accepted" ? "good" : "neutral"} />} meta={<span>{p.reference} · version {cur.number}</span>} />
      <ErrorSummary message={sp.error} />
      {sp.saved && <p role="status" className="mb-4 text-sm text-moss">Saved.</p>}
      {sp.sent && <p role="status" className="mb-4 text-sm text-moss">Sent. The link is delivered by the worker (local mail sink in development).</p>}
      {contract && <p className="mb-4 text-sm">Accepted. <Link className="underline" href={`/contracts/${contract.id}`}>Open contract draft {contract.reference}</Link></p>}
      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="ed">
          <h2 id="ed" className="mb-3">{editable ? "Edit draft" : "Sent version (read-only)"}</h2>
          {editable ? (
            <form action={saveDraftAction} className="space-y-4"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="version" value={p.version} />
              <ProposalFields initial={{ title: p.title, scope: cur.scope, terms: cur.terms, validUntil: cur.validUntil, recurringPeriod: cur.recurringPeriod, lines: cur.lines }} />
              <button className="btn btn-quiet">Save draft</button></form>
          ) : <div className="whitespace-pre-wrap text-sm">{cur.scope}</div>}
        </section>
        <section aria-labelledby="pv" className="space-y-6">
          <div><h2 id="pv" className="mb-2">Summary</h2>
            <p>One-off: <strong>{money(cur.oneOffMinor)}</strong></p>
            <p>Recurring: <strong>{money(cur.recurringMinor)}</strong>{cur.recurringPeriod ? ` / ${cur.recurringPeriod}` : ""}</p>
            <p className="hint">Valid until {cur.validUntil ? fmtDateTime(cur.validUntil) : "set when sent (30 days)"}</p></div>
          {editable && can(ctx.role, "proposal.send") && (
            <form action={sendProposalAction} className="space-y-2 border-t border-line pt-4"><input type="hidden" name="id" value={p.id} />
              <h2>Send for acceptance</h2>
              <label className="label" htmlFor="to">Recipient (check carefully)</label><input id="to" name="email" type="email" className="field" defaultValue={email} required />
              <p className="hint">Sends version {cur.number} exactly as saved; it cannot be edited afterwards, only revised as a new version.</p>
              <button className="btn">Send proposal</button></form>
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
