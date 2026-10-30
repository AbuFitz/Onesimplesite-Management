import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { projectWhere } from "@/modules/projects/service";
import { RecordHeader, Status, Empty } from "@/components/ui";

export const metadata = { title: "Projects" };
export default async function Projects({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  const ctx = await requireStaff();
  const { stage } = await searchParams;
  const rows = await db.project.findMany({ where: { ...projectWhere(ctx), ...(stage ? { stage: stage as never } : {}) }, include: { customer: true }, orderBy: { updatedAt: "desc" }, take: 100 });
  return (
    <>
      <RecordHeader title="Projects" meta={stage ? `Filtered: ${stage.replaceAll("_", " ")}` : undefined} />
      {rows.length === 0 ? <Empty title={stage ? "No projects at this stage" : "No projects yet"}>Projects are created when a contract is completed.</Empty> : (
        <ul>{rows.map((p) => (
          <li key={p.id} className="row"><Link href={`/projects/${p.id}`} className="flex flex-wrap justify-between gap-2 py-3 min-h-12 hover:bg-soft sm:-mx-3 sm:rounded-lg sm:px-3"><span><strong>{p.name}</strong><span className="block text-sm text-muted">{p.customer.displayName} · {p.reference}</span></span><Status label={p.stage} /></Link></li>
        ))}</ul>
      )}
    </>
  );
}
