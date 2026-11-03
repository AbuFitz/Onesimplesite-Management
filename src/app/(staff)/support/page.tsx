import Link from "next/link";
import { requireStaff } from "@/modules/identity/session";
import { listSupportTickets, supportCounts, type SupportFilter } from "@/modules/support/service";
import { STATUS_LABEL } from "@/modules/support/options";
import { RecordHeader, Status, Empty, timeAgo } from "@/components/ui";

export const metadata = { title: "Support tickets" };
const FILTERS: [SupportFilter, string][] = [["open", "Needs us"], ["waiting", "Waiting for customer"], ["mine", "Mine"], ["resolved", "Resolved"], ["all", "All"]];

export default async function Support({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const sp = await searchParams;
  const f = (FILTERS.find(([id]) => id === sp.f)?.[0] ?? "open") as SupportFilter;
  const [rows, counts] = await Promise.all([listSupportTickets(ctx, { filter: f, q: sp.q }), supportCounts(ctx.workspaceId)]);
  return (
    <>
      <RecordHeader title="Support tickets" meta={`${counts.open} need us · ${counts.waiting} waiting for a customer`} action={<Link className="btn" href="/support/new">New support ticket</Link>} />
      <nav aria-label="Filter" className="mb-4 flex flex-wrap gap-2">{FILTERS.map(([id, l]) => <Link key={id} className={`btn ${f === id ? "" : "btn-quiet"}`} href={`/support?f=${id}`}>{l}</Link>)}</nav>
      <form className="mb-4 max-w-md"><input type="hidden" name="f" value={f} /><label className="sr-only" htmlFor="q">Search tickets</label><input id="q" name="q" defaultValue={sp.q} className="field" placeholder="Search by title, reference or business" /></form>
      {rows.length === 0 ? <Empty title="Nothing here">When a customer raises a ticket in their portal it shows up here.</Empty> : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {rows.map((t) => { const s = STATUS_LABEL[t.status] ?? { label: t.status, kind: "neutral" as const }; return (
            <li key={t.id}><Link href={`/support/${t.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-bone/60">
              <span className="min-w-0"><span className="block truncate font-semibold">{t.title}</span><span className="text-sm text-muted">{t.reference} · {t.customer.displayName}{t.contact ? ` · ${t.contact.name}` : ""} · {timeAgo(t.updatedAt)}</span></span>
              <span className="flex items-center gap-2">{(t.priority === "urgent" || t.priority === "high") && <Status label={t.priority === "urgent" ? "Urgent" : "High"} kind="bad" />}<Status label={s.label} kind={s.kind} /></span>
            </Link></li>); })}
        </ul>
      )}
    </>
  );
}
