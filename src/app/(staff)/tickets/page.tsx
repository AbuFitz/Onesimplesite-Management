import Link from "next/link";
import { Plus } from "lucide-react";
import { requireStaff } from "@/modules/identity/session";
import { db } from "@/lib/db";
import { STATUS_LABEL, CATEGORY_LABEL, ONBOARDING_LABEL } from "@/modules/support/options";
import { RecordHeader, Status, Empty, timeAgo, money } from "@/components/ui";

export const metadata = { title: "Tickets" };
const TABS = [["needs", "Needs us"], ["waiting", "Waiting on customer"], ["done", "Done"], ["all", "All"]] as const;
const TYPES = [["all", "All types"], ["onboarding", "New website"], ["change_request", "Change requests"], ["support", "Support"]] as const;

type Row = { key: string; type: "onboarding" | "change_request" | "support"; href: string; title: string; business: string; businessId: string; person?: string; label: string; kind: "good" | "warn" | "bad" | "neutral"; bucket: "needs" | "waiting" | "done"; mine: boolean; at: Date; priority: string; extra?: string };

/** Every kind of ticket in one list, in one set of plain statuses. */
export default async function Tickets({ searchParams }: { searchParams: Promise<{ tab?: string; type?: string; q?: string; mine?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const sp = await searchParams;
  const tab = TABS.find(([id]) => id === sp.tab)?.[0] ?? "needs";
  const type = TYPES.find(([id]) => id === sp.type)?.[0] ?? "all";
  const q = sp.q?.trim().toLowerCase();
  const mine = sp.mine === "1";
  const [tickets, opps] = await Promise.all([
    type === "onboarding" ? [] : db.ticket.findMany({ where: { workspaceId: ctx.workspaceId, ...(type !== "all" ? { category: type } : {}) }, include: { customer: { select: { displayName: true } }, contact: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 300 }),
    type === "all" || type === "onboarding" ? db.opportunity.findMany({ where: { workspaceId: ctx.workspaceId }, include: { customer: { select: { displayName: true } }, proposals: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } } }, orderBy: { updatedAt: "desc" }, take: 300 }) : [],
  ]);
  const rows: Row[] = [
    ...tickets.map((t): Row => {
      const s = STATUS_LABEL[t.status] ?? { label: t.status, kind: "neutral" as const };
      const quoted = t.chargeStatus === "quoted";
      return { key: t.id, type: t.category === "change_request" ? "change_request" : "support", href: `/support/${t.id}`, title: t.title, business: t.customer.displayName, businessId: t.customerId, person: t.contact?.name, label: quoted ? "Waiting for approval" : s.label, kind: quoted ? "neutral" : s.kind, bucket: ["resolved", "closed"].includes(t.status) ? "done" : t.status === "waiting_customer" ? "waiting" : "needs", mine: t.assigneeId === ctx.staffId, at: t.updatedAt, priority: t.priority, extra: t.priceMinor ? `${money(t.priceMinor)}${t.chargeStatus === "paid" ? " · paid" : t.chargeStatus === "approved" ? " · approved" : t.chargeStatus === "declined" ? " · declined" : ""}` : undefined };
    }),
    ...opps.map((o): Row => {
      const s = ONBOARDING_LABEL[o.stage] ?? { label: o.stage, kind: "neutral" as const };
      return { key: o.id, type: "onboarding", href: o.proposals[0] ? `/proposals/${o.proposals[0].id}` : `/customers/${o.customerId}`, title: o.title, business: o.customer.displayName, businessId: o.customerId, label: s.label, kind: s.kind, bucket: o.stage === "won" || o.stage === "lost" ? "done" : o.stage === "proposal_sent" || o.stage === "contract_pending" ? "waiting" : "needs", mine: o.ownerId === ctx.staffId, at: o.updatedAt, priority: o.priority };
    }),
  ].filter((r) => (tab === "all" ? true : r.bucket === tab)).filter((r) => !mine || r.mine).filter((r) => !q || `${r.title} ${r.business}`.toLowerCase().includes(q)).sort((a, b) => +b.at - +a.at);
  const href = (t: string, ty: string, m = mine) => `/tickets?tab=${t}&type=${ty}${m ? "&mine=1" : ""}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`;
  return (
    <>
      <RecordHeader title="Tickets" meta="New websites, change requests and support, all in one place" action={<Link className="btn" href="/tickets/new"><Plus size={16} aria-hidden /> New ticket</Link>} />
      <nav aria-label="Status" className="mb-3 flex flex-wrap gap-1.5">{TABS.map(([id, l]) => <Link key={id} href={href(id, type)} aria-current={tab === id ? "page" : undefined} className={`btn ${tab === id ? "btn-dark" : "btn-quiet"}`}>{l}</Link>)}</nav>
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <nav aria-label="Type" className="flex flex-wrap gap-1.5 text-sm">{TYPES.map(([id, l]) => <Link key={id} href={href(tab, id)} aria-current={type === id ? "page" : undefined} className={`rounded-lg px-3 py-1.5 font-semibold ${type === id ? "bg-ink text-white" : "bg-bone hover:bg-[#e6e2d8]"}`}>{l}</Link>)}</nav>
        <Link href={href(tab, type, !mine)} role="switch" aria-checked={mine} className="ml-auto inline-flex min-h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-semibold hover:bg-bone"><span className={`relative h-5 w-9 rounded-full transition-colors ${mine ? "bg-ink" : "bg-line"}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${mine ? "left-[1.1rem]" : "left-0.5"}`} /></span>Only mine</Link>
        <form><input type="hidden" name="tab" value={tab} /><input type="hidden" name="mine" value={mine ? "1" : ""} /><input type="hidden" name="type" value={type} /><label className="sr-only" htmlFor="q">Search</label><input id="q" name="q" defaultValue={sp.q} className="field !min-h-9 w-56" placeholder="Search tickets" /></form>
      </div>
      {rows.length === 0 ? <Empty title="Nothing here">{tab === "needs" ? "You're all caught up." : "No tickets match."}</Empty> : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {rows.map((r) => (
            <li key={r.key}><Link href={r.href} className="grid items-center gap-2 px-4 py-3 hover:bg-bone/60 sm:grid-cols-[1fr_auto]">
              <span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${CATEGORY_LABEL[r.type].cls}`}>{CATEGORY_LABEL[r.type].label}</span><span className="truncate font-semibold">{r.title}</span></span>
                <span className="text-sm text-muted">{r.business}{r.person ? ` · ${r.person}` : ""} · {timeAgo(r.at)}{r.extra ? ` · ${r.extra}` : ""}</span></span>
              <span className="flex items-center gap-2">{(r.priority === "urgent" || r.priority === "high") && <Status label={r.priority === "urgent" ? "Urgent" : "High"} kind="bad" />}<Status label={r.label} kind={r.kind} /></span>
            </Link></li>
          ))}
        </ul>
      )}
    </>
  );
}
