import Link from "next/link";
import { Plus } from "lucide-react";
import { requireStaff } from "@/modules/identity/session";
import { db } from "@/lib/db";
import { STATUS_LABEL, CATEGORY_LABEL } from "@/modules/support/options";
import { RecordHeader, Status, Empty, timeAgo, money } from "@/components/ui";
import { AutoGetForm } from "@/components/auto-form";
import { Search } from "lucide-react";

export const metadata = { title: "Tickets" };
const TABS = [["needs", "Needs us"], ["waiting", "Waiting on customer"], ["done", "Done"], ["all", "All"]] as const;
const TYPES = [["all", "All types"], ["change_request", "Change requests"], ["support", "Support"]] as const;

type Row = { key: string; type: "change_request" | "support"; href: string; title: string; business: string; businessId: string; person?: string; label: string; kind: "good" | "warn" | "bad" | "neutral"; bucket: "needs" | "waiting" | "done"; mine: boolean; at: Date; priority: string; extra?: string };

/** Every kind of ticket in one list, in one set of plain statuses. */
export default async function Tickets({ searchParams }: { searchParams: Promise<{ tab?: string; type?: string; q?: string; mine?: string; s?: string; c?: string; p?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const sp = await searchParams;
  const tab = TABS.find(([id]) => id === sp.tab)?.[0] ?? "needs";
  const type = TYPES.find(([id]) => id === sp.type)?.[0] ?? "all";
  const q = sp.q?.trim().toLowerCase();
  const mine = sp.mine === "1";
  const st = sp.s?.trim() || "", company = sp.c?.trim() || "", pr = ["urgent", "high", "normal", "low", "attention"].includes(String(sp.p)) ? String(sp.p) : "";
  const [tickets] = await Promise.all([
    db.ticket.findMany({ where: { workspaceId: ctx.workspaceId, ...(type !== "all" ? { category: type } : {}) }, include: { customer: { select: { displayName: true } }, contact: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 300 }),
  ]);
  const all: Row[] = [
    ...tickets.map((t): Row => {
      const s = STATUS_LABEL[t.status] ?? { label: t.status, kind: "neutral" as const };
      const quoted = t.chargeStatus === "quoted";
      return { key: t.id, type: t.category === "change_request" ? "change_request" : "support", href: `/support/${t.id}`, title: t.title, business: t.customer.displayName, businessId: t.customerId, person: t.contact?.name, label: quoted ? "Waiting for approval" : s.label, kind: quoted ? "neutral" : s.kind, bucket: ["resolved", "closed"].includes(t.status) ? "done" : t.status === "waiting_customer" ? "waiting" : "needs", mine: t.assigneeId === ctx.staffId, at: t.updatedAt, priority: t.priority, extra: t.priceMinor ? `${money(t.priceMinor)}${t.chargeStatus === "paid" ? " · paid" : t.chargeStatus === "approved" ? " · approved" : t.chargeStatus === "declined" ? " · declined" : ""}` : undefined };
    }),
  ];
  // One place decides what a filter means, so the counts on every chip match what you will see when you click it.
  const only = (skip: ("tab" | "type")[] = []) => all.filter((r) => (skip.includes("tab") || tab === "all" || r.bucket === tab) && (skip.includes("type") || type === "all" || r.type === type) && (!mine || r.mine) && (!q || `${r.title} ${r.business}`.toLowerCase().includes(q)) && (!st || r.label === st) && (!company || r.businessId === company) && (!pr || (pr === "attention" ? r.priority === "urgent" || r.priority === "high" : r.priority === pr)));
  const rows = only().sort((a, b) => +b.at - +a.at);
  const tabCount = (id: string) => only(["tab"]).filter((r) => id === "all" || r.bucket === id).length;
  const typeCount = (id: string) => only(["type"]).filter((r) => id === "all" || r.type === id).length;
  const labels = [...new Set(all.map((r) => r.label))].sort();
  const companies = [...new Map(all.map((r) => [r.businessId, r.business])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const href = (o: Partial<{ tab: string; type: string; mine: boolean }> = {}) => {
    const p = new URLSearchParams(); const t = o.tab ?? tab, ty = o.type ?? type, m = o.mine ?? mine;
    if (t !== "needs") p.set("tab", t); if (ty !== "all") p.set("type", ty); if (m) p.set("mine", "1");
    if (sp.q) p.set("q", sp.q); if (st) p.set("s", st); if (company) p.set("c", company); if (pr) p.set("p", pr);
    const qs = p.toString(); return `/tickets${qs ? `?${qs}` : ""}`;
  };
  const extra = [!!st, !!company, !!pr, mine, !!q].filter(Boolean).length;
  return (
    <>
      <RecordHeader title="Tickets" meta="Change requests and support. New websites are in Agreements." action={<Link className="btn" href="/tickets/new"><Plus size={16} aria-hidden /> New ticket</Link>} />
      <AutoGetForm className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(5,minmax(0,1fr))_auto]">
        <div className="relative col-span-2 min-w-0 lg:col-span-1"><Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-[2.2rem] text-muted" /><label className="mb-1 block text-xs font-semibold text-muted" htmlFor="q">Search</label>
          <input id="q" name="q" type="search" defaultValue={sp.q} placeholder="Title or company" className="field !pl-9" /></div>
        <div><label className="mb-1 block text-xs font-semibold text-muted" htmlFor="tab">Show</label>
          <select id="tab" name="tab" defaultValue={tab} className="field">{TABS.map(([id, l]) => <option key={id} value={id}>{l} ({tabCount(id)})</option>)}</select></div>
        <div><label className="mb-1 block text-xs font-semibold text-muted" htmlFor="type">Type</label>
          <select id="type" name="type" defaultValue={type} className="field">{TYPES.map(([id, l]) => <option key={id} value={id}>{l} ({typeCount(id)})</option>)}</select></div>
        <div><label className="mb-1 block text-xs font-semibold text-muted" htmlFor="f-s">Exact status</label>
          <select id="f-s" name="s" defaultValue={st} className="field"><option value="">Any</option>{labels.map((l) => <option key={l} value={l}>{l}</option>)}</select></div>
        <div><label className="mb-1 block text-xs font-semibold text-muted" htmlFor="f-c">Company</label>
          <select id="f-c" name="c" defaultValue={company} className="field"><option value="">Any</option>{companies.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></div>
        <div><label className="mb-1 block text-xs font-semibold text-muted" htmlFor="f-p">Priority</label>
          <select id="f-p" name="p" defaultValue={pr} className="field"><option value="">Any</option><option value="attention">Urgent or high</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></div>
        <div className="col-span-2 flex flex-wrap items-end gap-x-4 gap-y-1 lg:col-span-1">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" name="mine" value="1" defaultChecked={mine} className="size-4 accent-[#0c6a49]" /> Only mine</label>
          {(extra > 0 || tab !== "needs" || type !== "all") && <Link href="/tickets" className="min-h-11 py-2.5 text-sm underline">Clear</Link>}
        </div>
      </AutoGetForm>
      <p className="-mt-2 mb-3 text-sm text-muted">{rows.length} {rows.length === 1 ? "ticket" : "tickets"}</p>
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
