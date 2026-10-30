import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { stageAction } from "@/app/actions/crm";
import { RecordHeader, Status, Empty, ErrorSummary, fmtDate } from "@/components/ui";

export const metadata = { title: "Tickets" };

/** One word per step, in the order work moves. The stored stages are finer; people see these. */
const FILTERS = [
  { id: "open", label: "Open", stages: ["new", "qualified", "proposal_sent"] },
  { id: "contract_pending", label: "Waiting to sign", stages: ["contract_pending"] },
  { id: "won", label: "Signed", stages: ["won"] },
  { id: "lost", label: "Lost", stages: ["lost"] },
] as const;
const LABEL: Record<string, string> = { new: "New", qualified: "In progress", proposal_sent: "In progress", contract_pending: "Waiting to sign", won: "Signed", lost: "Lost" };
const KIND: Record<string, "good" | "warn" | "bad" | "neutral"> = { won: "good", contract_pending: "warn", lost: "bad" };

export default async function Tickets({ searchParams }: { searchParams: Promise<{ stage?: string; error?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const sp = await searchParams;
  const f = FILTERS.find((x) => x.id === sp.stage);
  const rows = await db.opportunity.findMany({
    where: { workspaceId: ctx.workspaceId, ...(f ? { stage: { in: [...f.stages] } } : {}) },
    include: { customer: true, proposals: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } } },
    orderBy: { updatedAt: "desc" }, take: 100,
  });
  const canEdit = can(ctx.role, "opportunity.write");
  return (
    <>
      <RecordHeader title="Tickets" meta="One ticket for each piece of work, from first contact to signed" />
      <ErrorSummary message={sp.error} />
      <nav aria-label="Filter" className="mb-4 flex flex-wrap gap-2">
        <Link className={`btn ${f ? "btn-quiet" : ""}`} href="/pipeline">All</Link>
        {FILTERS.map((x) => <Link key={x.id} className={`btn ${f?.id === x.id ? "" : "btn-quiet"}`} href={`/pipeline?stage=${x.id}`}>{x.label}</Link>)}
      </nav>
      {rows.length === 0 ? <Empty title="No tickets here"><Link className="underline" href="?new=ticket">Create a ticket</Link></Empty> : (
        <ul>
          {rows.map((o) => {
            const open = o.stage !== "won" && o.stage !== "lost";
            const href = o.proposals[0] ? `/proposals/${o.proposals[0].id}` : `/customers/${o.customerId}`;
            return (
              <li key={o.id} className="row grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center">
                <div className="min-w-0">
                  <Link className="font-semibold break-words hover:underline" href={href}>{o.title}</Link>
                  <p className="text-sm text-muted"><Link className="hover:underline" href={`/customers/${o.customerId}`}>{o.customer.displayName}</Link>{o.dueDate ? ` · due ${fmtDate(o.dueDate)}` : ""}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Status label={LABEL[o.stage] ?? o.stage} kind={KIND[o.stage] ?? "neutral"} />
                    {o.priority !== "normal" && <span className={`pill ${o.priority === "urgent" ? "pill-bad" : o.priority === "high" ? "pill-warn" : "pill-neutral"}`}>{o.priority}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={href} className="btn btn-quiet">Open</Link>
                  {canEdit && open && (
                    <form action={stageAction}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="version" value={o.version} /><input type="hidden" name="stage" value="lost" />
                      <button className="btn btn-quiet" title="Mark this ticket as lost">Mark lost</button></form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
