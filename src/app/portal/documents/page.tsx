import { db } from "@/lib/db";
import { requireClient } from "@/modules/identity/session";
import { Empty, Status, fmtDateTime } from "@/components/ui";

export const metadata = { title: "Documents" };
export default async function PortalDocuments() {
  const c = await requireClient();
  const rows = await db.contract.findMany({ where: { customerId: { in: c.memberships.map((m) => m.customerId) }, status: "completed", documents: { some: {} } }, orderBy: { completedAt: "desc" }, select: { id: true, title: true, reference: true, completedAt: true } });
  return (
    <>
      <h1 className="mb-6">Documents</h1>
      {rows.length === 0 ? <Empty title="No signed documents yet" /> : (
        <ul>{rows.map((r) => <li key={r.id} className="row flex flex-wrap items-center justify-between gap-3 py-4"><span><strong>{r.title}</strong><span className="block text-sm text-muted">{r.reference} · signed {r.completedAt && fmtDateTime(r.completedAt)}</span></span><span className="flex items-center gap-3"><Status label="signed" kind="good" /><a className="btn btn-quiet" href={`/documents/${r.id}/pdf`}>Download PDF</a></span></li>)}</ul>
      )}
    </>
  );
}
