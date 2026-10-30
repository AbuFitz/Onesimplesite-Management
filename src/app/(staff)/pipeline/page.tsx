import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { stageAction } from "@/app/actions/crm";
import { RecordHeader, Status, Empty, ErrorSummary, fmtDate } from "@/components/ui";

export const metadata = { title: "Deals" };
const LABEL: Record<string, string> = { new: "Just added", qualified: "Talking", proposal_sent: "Quote sent", contract_pending: "Waiting to sign", won: "Signed", lost: "Lost" };
const STAGES = ["new", "qualified", "proposal_sent", "contract_pending", "won", "lost"] as const;

export default async function Pipeline({ searchParams }: { searchParams: Promise<{ stage?: string; error?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const sp = await searchParams;
  const stage = STAGES.find((s) => s === sp.stage);
  const rows = await db.opportunity.findMany({ where: { workspaceId: ctx.workspaceId, ...(stage ? { stage } : {}) }, include: { customer: true }, orderBy: { updatedAt: "desc" }, take: 100 });
  return (
    <>
      <RecordHeader title="Deals" meta="Every customer you are working with and where they are up to" />
      <p className="mb-5 max-w-2xl text-sm text-muted">Deals move on their own: sending a quote or agreement moves it forward, and it becomes Signed when the customer signs. You only need to change one by hand to mark it Lost.</p>
      <ErrorSummary message={sp.error} />
      <nav aria-label="Stage filter" className="mb-4 flex flex-wrap gap-2">
        <Link className={`btn ${stage ? "btn-quiet" : ""}`} href="/pipeline">All</Link>
        {STAGES.map((s) => <Link key={s} className={`btn ${stage === s ? "" : "btn-quiet"}`} href={`/pipeline?stage=${s}`}>{LABEL[s]}</Link>)}
      </nav>
      {rows.length === 0 ? <Empty title="No deals in this view" /> : (
        <ul>
          {rows.map((o) => (
            <li key={o.id} className="row py-3 grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
              <div className="min-w-0"><Link className="font-semibold break-words" href={`/customers/${o.customerId}`}>{o.customer.displayName}</Link><p className="text-sm text-muted">{o.title}{o.dueDate ? ` · due ${fmtDate(o.dueDate)}` : ""}</p><Status label={LABEL[o.stage] ?? o.stage} />{o.priority !== "normal" && <span className={`pill ml-1.5 ${o.priority === "urgent" ? "pill-bad" : o.priority === "high" ? "pill-warn" : "pill-neutral"}`}>{o.priority}</span>}</div>
              <form action={stageAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={o.id} /><input type="hidden" name="version" value={o.version} />
                <div><label className="sr-only" htmlFor={`s-${o.id}`}>Change stage for {o.title}</label>
                  <select id={`s-${o.id}`} name="stage" defaultValue={o.stage} className="field w-auto">{STAGES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}</select></div>
                <button className="btn btn-quiet">Update</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
