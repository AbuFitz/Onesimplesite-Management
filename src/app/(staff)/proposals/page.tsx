import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { RecordHeader, Status, Empty } from "@/components/ui";

export const metadata = { title: "Proposals" };
export default async function Proposals({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const { status } = await searchParams;
  const rows = await db.proposal.findMany({ where: { workspaceId: ctx.workspaceId, ...(status ? { status: status as never } : {}) }, include: { customer: true }, orderBy: { updatedAt: "desc" }, take: 100 });
  return (
    <>
      <RecordHeader title="Proposals" meta={status ? `Filtered: ${status}` : undefined} />
      {rows.length === 0 ? <Empty title="No proposals here yet">Start one from a customer record.</Empty> : (
        <ul>{rows.map((p) => <li key={p.id} className="row"><Link href={`/proposals/${p.id}`} className="flex flex-wrap justify-between gap-2 py-3 min-h-12 hover:bg-soft sm:-mx-3 sm:rounded-lg sm:px-3"><span><strong>{p.title}</strong><span className="block text-sm text-muted">{p.customer.displayName} · {p.reference} · v{p.currentVersion}</span></span><Status label={p.status} kind={p.status === "accepted" ? "good" : "neutral"} /></Link></li>)}</ul>
      )}
    </>
  );
}
