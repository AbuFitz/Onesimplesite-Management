import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { contractSentAction, completionAction } from "@/app/actions/crm";
import { RecordHeader, Status, ErrorSummary, money, fmtDateTime } from "@/components/ui";

export const metadata = { title: "Contract" };
export default async function ContractPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const { id } = await params;
  const { error } = await searchParams;
  const k = await db.contract.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: { customer: true, project: true, billingIntents: true } });
  if (!k) notFound();
  return (
    <>
      <RecordHeader back={{ href: `/customers/${k.customerId}`, label: k.customer.displayName }} title={k.title} status={<Status label={k.status} kind={k.status === "completed" ? "good" : "warn"} />} meta={<span>{k.reference}</span>} />
      <ErrorSummary message={error} />
      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="scope"><h2 id="scope" className="mb-2">Scope snapshot (from accepted proposal)</h2><div className="whitespace-pre-wrap text-sm max-w-2xl">{k.scopeSnapshot}</div></section>
        <aside className="space-y-6">
          <div><p>One-off {money(k.oneOffMinor, k.currency)}</p><p>Recurring {money(k.recurringMinor, k.currency)}</p></div>
          <p className="hint">Signing route: <strong>{k.signingMode.replace("_", " ")}</strong>. In this mode the contract is signed outside the app; staff record completion with evidence. The app does not verify the signature itself.</p>
          {k.status === "draft" && can(ctx.role, "contract.send") && (
            <form action={contractSentAction}><input type="hidden" name="id" value={k.id} /><button className="btn">Mark as sent for signature</button><p className="hint mt-1">Record that you sent it via the agreed signing route.</p></form>
          )}
          {(k.status === "draft" || k.status === "awaiting_signature") && can(ctx.role, "contract.record_completion") && (
            <form action={completionAction} className="space-y-2"><input type="hidden" name="id" value={k.id} />
              <label className="label" htmlFor="ev">Completion evidence</label><textarea id="ev" name="evidence" className="field" required minLength={10} placeholder="Where the signed document is held, who signed, date…" />
              <button className="btn">Record completion</button>
              <p className="hint">Creates the project and billing intentions once. A completed signature does not imply payment.</p></form>
          )}
          {k.status === "completed" && <p className="text-sm">Completion recorded by {k.completionRecordedBy} on {k.completedAt && fmtDateTime(k.completedAt)}.<br /><span className="text-muted">Evidence: {k.completionEvidence}</span>{k.project && <><br /><Link className="underline" href={`/projects/${k.project.id}`}>Open project</Link></>}</p>}
          {k.billingIntents.length > 0 && <div><p className="label">Billing intentions (not invoices)</p>{k.billingIntents.map((b) => <p key={b.id} className="text-sm">{b.kind.replace("_", " ")} · {money(b.amountMinor, b.currency)} · {b.status}</p>)}</div>}
        </aside>
      </div>
    </>
  );
}
