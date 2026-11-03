import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { projectWhere, STAGE_GUIDE, typeOf } from "@/modules/projects/service";
import { RecordHeader, Empty, fmtDate } from "@/components/ui";
import { Ring, CHART } from "@/components/charts";

export const metadata = { title: "Projects" };
const STEP = { planned: 0.1, awaiting_assets: 0.2, design: 0.4, development: 0.6, qa: 0.75, client_review: 0.85, ready_to_launch: 0.95, launched: 1, completed: 1 } as Record<string, number>;
const FILTERS: [string, string][] = [["", "All"], ["planned", "Planning"], ["awaiting_assets", "Waiting"], ["design", "Design"], ["development", "Build"], ["qa", "Testing"], ["client_review", "Review"], ["ready_to_launch", "Launching"], ["launched", "Live"]];

export default async function Projects({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  const ctx = await requireStaff();
  const { stage } = await searchParams;
  const rows = await db.project.findMany({ where: { ...projectWhere(ctx), ...(stage ? { stage: stage as never } : {}) }, include: { customer: { select: { displayName: true } }, _count: { select: { tasks: true } } }, orderBy: { updatedAt: "desc" }, take: 100 });
  const doneBy = new Map((await db.task.groupBy({ by: ["projectId"], where: { projectId: { in: rows.map((r) => r.id) }, doneAt: { not: null } }, _count: true })).map((t) => [t.projectId, t._count]));
  return (
    <>
      <RecordHeader title="Projects" meta="Every website we're building or looking after, and what to do next on each" />
      <nav aria-label="Stage" className="mb-5 flex flex-wrap gap-1.5">{FILTERS.map(([id, l]) => <Link key={id} href={id ? `/projects?stage=${id}` : "/projects"} aria-current={(stage ?? "") === id ? "page" : undefined} className={`btn !min-h-11 sm:!min-h-9 ${(stage ?? "") === id ? "btn-dark" : "btn-quiet"}`}>{l}</Link>)}</nav>
      {rows.length === 0 ? <Empty title={stage ? "No projects at this stage" : "No projects yet"}>A project is created automatically when a customer signs their agreement.</Empty> : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map((p) => {
          const done = doneBy.get(p.id) ?? 0, total = p._count.tasks;
          const g = STAGE_GUIDE[p.stage];
          return (
            <li key={p.id}><Link href={`/projects/${p.id}`} className="flex h-full flex-col gap-3 rounded-2xl border border-[var(--card-line)] bg-white p-4 shadow-[0_1px_2px_rgba(14,19,17,.06)] transition-shadow hover:shadow-[0_6px_20px_rgba(12,19,34,.12)]">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[17px] font-bold">{p.name}</p><p className="text-sm text-ink/70">{p.customer.displayName} · {typeOf(p.workType).label}</p></div>
                <Ring size={64} thickness={9} value={STEP[p.stage] ?? 0.1} color={p.stage === "launched" || p.stage === "completed" ? CHART.teal : CHART.green} label="" /></div>
              <p className="rounded-lg bg-[var(--color-soft)] px-3 py-2 text-[14px]"><span className="font-bold">{g?.label ?? p.stage.replaceAll("_", " ")}.</span> {g?.now ?? ""}</p>
              <p className="mt-auto flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink/70"><span>{total ? `${done} of ${total} tasks done` : "No tasks yet"}</span><span>{p.dueDate ? `Due ${fmtDate(p.dueDate)}` : "No due date"}</span></p>
            </Link></li>);
        })}</ul>
      )}
    </>
  );
}
