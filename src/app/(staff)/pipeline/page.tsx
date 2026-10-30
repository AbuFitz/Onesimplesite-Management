import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { stageAction } from "@/app/actions/crm";
import { RecordHeader, Status, Empty, ErrorSummary, money } from "@/components/ui";

export const metadata = { title: "Pipeline" };
const STAGES = ["new", "qualified", "proposal_sent", "contract_pending", "won", "lost"] as const;

export default async function Pipeline({ searchParams }: { searchParams: Promise<{ stage?: string; error?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const sp = await searchParams;
  const stage = STAGES.find((s) => s === sp.stage);
  const rows = await db.opportunity.findMany({ where: { workspaceId: ctx.workspaceId, ...(stage ? { stage } : {}) }, include: { customer: true }, orderBy: { updatedAt: "desc" }, take: 100 });
  return (
    <>
      <RecordHeader title="Pipeline" />
      <ErrorSummary message={sp.error} />
      <nav aria-label="Stage filter" className="mb-4 flex flex-wrap gap-2">
        <Link className={`btn ${stage ? "btn-quiet" : ""}`} href="/pipeline">All</Link>
        {STAGES.map((s) => <Link key={s} className={`btn ${stage === s ? "" : "btn-quiet"}`} href={`/pipeline?stage=${s}`}>{s.replaceAll("_", " ")}</Link>)}
      </nav>
      {rows.length === 0 ? <Empty title="No opportunities in this view" /> : (
        <ul>
          {rows.map((o) => (
            <li key={o.id} className="row py-3 grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
              <div className="min-w-0"><Link className="font-semibold break-words" href={`/customers/${o.customerId}`}>{o.customer.displayName}</Link><p className="text-sm text-muted">{o.title} · {money(o.valueMinor, o.currency)}</p><Status label={o.stage} /></div>
              <form action={stageAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={o.id} /><input type="hidden" name="version" value={o.version} />
                <div><label className="sr-only" htmlFor={`s-${o.id}`}>Change stage for {o.title}</label>
                  <select id={`s-${o.id}`} name="stage" defaultValue={o.stage} className="field w-auto">{STAGES.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select></div>
                <div><label className="sr-only" htmlFor={`r-${o.id}`}>Reason if lost</label><input id={`r-${o.id}`} name="lossReason" placeholder="Reason if lost" className="field w-44" /></div>
                <button className="btn btn-quiet">Change stage</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
