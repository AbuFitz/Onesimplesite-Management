import { requireStaff } from "@/modules/identity/session";
import { lastExport, isBackupDue } from "@/modules/export/service";
import { RecordHeader, Status, fmtDateTime } from "@/components/ui";
import { db } from "@/lib/db";

export const metadata = { title: "Backup" };
export default async function Backup() {
  const ctx = await requireStaff("data.export");
  const last = await lastExport(ctx.workspaceId);
  const due = isBackupDue(last);
  const [customers, contracts, signed] = await Promise.all([
    db.customer.count({ where: { workspaceId: ctx.workspaceId } }), db.contract.count({ where: { workspaceId: ctx.workspaceId } }), db.contractDocument.count({ where: { workspaceId: ctx.workspaceId } }),
  ]);
  return (
    <>
      <RecordHeader title="Backup" meta="Download a copy of your business data" status={<Status label={due ? "backup due" : "up to date"} kind={due ? "warn" : "good"} />} />
      <section className="max-w-2xl space-y-6">
        <p>{last ? <>Last backup: <strong>{fmtDateTime(last.createdAt)}</strong> by {last.actorLabel}.</> : <strong>No backup has been taken yet.</strong>} Aim for once a week.</p>
        <p className="text-sm text-muted">Currently holds {customers} customer(s), {contracts} contract(s) and {signed} signed PDF(s).</p>
        <a className="btn" href="/backup/download">Download backup</a>
        <div className="border-l-4 border-warn bg-wash px-3 py-3 text-sm space-y-2">
          <p><strong>Keep the file safe.</strong> It contains customer details and signed contracts. Store it somewhere private (an encrypted drive or a locked folder), not in an email or shared chat.</p>
          <p><strong>What is included:</strong> customers, contacts, proposals, contracts, signatures and signed PDFs, projects, calendar, notes, terms, and the activity log.</p>
          <p><strong>What is not:</strong> logins and passwords, sessions and one-time links. People can be re-invited if the system ever has to be rebuilt.</p>
        </div>
        <p className="hint">Each download is recorded in the activity log. This is a manual copy, not an automatic backup.</p>
      </section>
    </>
  );
}
