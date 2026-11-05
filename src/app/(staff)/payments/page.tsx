import Link from "next/link";
import { Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { RecordHeader, Status, Empty, fmtDate, money } from "@/components/ui";
import { AutoGetForm } from "@/components/auto-form";
import { KIND_LABEL, isMonthly, isScheduled, plainStatus, scheduledLabel } from "@/modules/billing/service";

export const metadata = { title: "Payments" };
const SHOW = [["due", "Due now"], ["later", "Due before launch"], ["plans", "Monthly plans"], ["free", "Free care periods"], ["failed", "Failed"], ["paid", "Paid"], ["all", "Everything"]] as const;
const HELP: Record<string, string> = {
  due: "Money we can ask for right now: deposits, website fees, change requests and monthly plans not started yet.",
  later: "Waiting for launch: final payments (asked for at Ready to launch) and care plans, including free care periods (start when the site is live). Both can also be started by hand from the order.",
  plans: "Monthly plans that are running. This is the monthly income on the home page.",
  free: "Care plans that are free for a set time and then simply end. Nothing is ever charged. They are not counted as income.",
  failed: "A monthly payment that did not go through.",
  paid: "Everything that has been paid.",
  all: "Every charge, in the order they were created.",
};

type B = Awaited<ReturnType<typeof load>>[number] & { customer: { displayName: string } };
const load = (workspaceId: string) => db.billingIntent.findMany({ where: { workspaceId }, include: { contract: { select: { id: true, reference: true, title: true } }, ticket: { select: { id: true, reference: true, title: true } } }, orderBy: { createdAt: "desc" }, take: 500 });
const group = (b: B) => (isScheduled(b) ? "later" : b.paidVia === "free" ? "free" : b.status === "past_due" ? "failed" : b.status === "paid" ? "paid" : isMonthly(b.kind) && b.status === "active" ? "plans" : b.status === "pending" ? "due" : "other");

/** Where the money numbers on the home page come from: every charge, grouped the same way, with a link to the order behind it. */
export default async function Payments({ searchParams }: { searchParams: Promise<{ show?: string; q?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const sp = await searchParams;
  const show = SHOW.find(([id]) => id === sp.show)?.[0] ?? "due";
  const q = sp.q?.trim().toLowerCase();
  const loaded = await load(ctx.workspaceId);
  const names = new Map((await db.customer.findMany({ where: { id: { in: [...new Set(loaded.map((b) => b.customerId))] } }, select: { id: true, displayName: true } })).map((c) => [c.id, c.displayName]));
  const all: B[] = loaded.map((b) => ({ ...b, customer: { displayName: names.get(b.customerId) ?? "Company" } }));
  const inScope = (b: B) => !q || `${b.customer.displayName} ${b.description ?? ""} ${b.contract?.reference ?? ""} ${b.ticket?.reference ?? ""}`.toLowerCase().includes(q);
  const count = (id: string) => all.filter((b) => inScope(b) && (id === "all" || group(b) === id)).length;
  const rows = all.filter((b) => inScope(b) && (show === "all" || group(b) === show));
  const total = rows.filter((b) => b.paidVia !== "free").reduce((n, b) => n + b.amountMinor, 0);
  return (
    <>
      <RecordHeader title="Payments" meta="What is owed, what is coming and what has been paid" />
      <AutoGetForm className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="relative col-span-2 min-w-0 lg:col-span-1"><Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-[2.2rem] text-muted" /><label className="mb-1 block text-xs font-semibold text-muted" htmlFor="q">Search</label>
          <input id="q" name="q" type="search" defaultValue={sp.q} placeholder="Company, order or item" className="field !pl-9" /></div>
        <div className="col-span-2 lg:col-span-1"><label className="mb-1 block text-xs font-semibold text-muted" htmlFor="show">Show</label>
          <select id="show" name="show" defaultValue={show} className="field">{SHOW.map(([id, l]) => <option key={id} value={id}>{l} ({count(id)})</option>)}</select></div>
      </AutoGetForm>
      <p className="mb-1 max-w-3xl text-sm text-muted">{HELP[show]}</p>
      <p className="mb-4 text-sm font-semibold">{rows.length} {rows.length === 1 ? "charge" : "charges"}{show !== "free" && rows.length > 0 ? ` · ${money(total)}${show === "plans" ? " a month" : ""}` : ""}</p>
      {rows.length === 0 ? <Empty title="Nothing here">{show === "due" ? "Nothing is waiting to be paid right now." : "No charges match."}</Empty> : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {rows.map((b) => {
            const st = !isScheduled(b) ? plainStatus(b.kind, b.status, b.cancelsAt, b.trialEndsAt, b.paidVia === "free") : { label: scheduledLabel(b), tone: "off" as const };
            const href = b.contract ? `/contracts/${b.contract.id}` : b.ticket ? `/support/${b.ticket.id}` : `/customers/${b.customerId}`;
            const of = b.contract?.reference ?? b.ticket?.reference ?? "";
            return (
              <li key={b.id}><Link href={href} className="grid items-center gap-2 px-4 py-3 hover:bg-bone/60 sm:grid-cols-[1fr_auto]">
                <span className="min-w-0"><span className="block truncate font-semibold">{b.description ?? KIND_LABEL[b.kind] ?? b.kind}</span>
                  <span className="text-sm text-muted">{b.customer.displayName} · {of}{b.paidAt && b.paidVia !== "free" ? ` · paid ${fmtDate(b.paidAt)}` : b.requestedAt && b.kind === "balance" && b.status === "pending" ? ` · asked ${fmtDate(b.requestedAt)}` : ""}</span></span>
                <span className="flex items-center gap-3"><span className="font-bold tabular-nums">{b.paidVia === "free" ? "Free" : money(b.amountMinor, b.currency)}{isMonthly(b.kind) && b.paidVia !== "free" ? <span className="text-sm font-medium text-muted"> / month</span> : ""}</span>
                  <Status label={st.label} kind={st.tone === "ok" ? "good" : st.tone === "warn" ? "bad" : st.tone === "due" ? "warn" : "neutral"} /></span>
              </Link></li>
            );
          })}
        </ul>
      )}
    </>
  );
}
