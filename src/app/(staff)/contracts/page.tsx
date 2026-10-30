import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { RecordHeader, Status, Empty } from "@/components/ui";

export const metadata = { title: "Contracts" };
export default async function Contracts({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const { status } = await searchParams;
  const rows = await db.contract.findMany({ where: { workspaceId: ctx.workspaceId, ...(status ? { status: status as never } : {}) }, include: { customer: true }, orderBy: { updatedAt: "desc" }, take: 100 });
  return (
    <>
      <RecordHeader title="Agreements" meta={status ? `Filtered: ${status.replaceAll("_", " ")}` : undefined} />
      <p className="mb-5 max-w-2xl text-sm text-muted">Every agreement that has been sent, with whether it is waiting for a signature or signed. Signed copies are saved here and in the customer's portal.</p>
      {rows.length === 0 ? <Empty title="No contracts here yet">A contract draft is created when a proposal is accepted.</Empty> : (
        <ul>{rows.map((k) => <li key={k.id} className="row"><Link href={`/contracts/${k.id}`} className="flex flex-wrap justify-between gap-2 py-3 min-h-12 hover:bg-soft sm:-mx-3 sm:rounded-lg sm:px-3"><span><strong>{k.title}</strong><span className="block text-sm text-muted">{k.customer.displayName} · {k.reference}</span></span><Status label={k.status} kind={k.status === "completed" ? "good" : "warn"} /></Link></li>)}</ul>
      )}
    </>
  );
}
