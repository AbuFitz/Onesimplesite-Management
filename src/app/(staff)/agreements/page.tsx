import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { Status, Empty, timeAgo, money } from "@/components/ui";
import { AutoGetForm } from "@/components/auto-form";
import { QuickChips, FilterPanel } from "@/components/filter-bar";
import { promoFrom } from "@/modules/billing/promo";

export const metadata = { title: "Agreements" };
const SHOW = [["open", "Open"], ["draft", "Being written"], ["awaiting", "Waiting for signature"], ["signed", "Signed"], ["closed", "Cancelled, declined or expired"], ["all", "Everything"]] as const;
const plan = (one: number, rec: number, req: unknown) => `${money(one)}${rec ? (promoFrom((req ?? {}) as Record<string, string | undefined>, one)?.endsAfter ? " + free care plan" : ` + ${money(rec)}/mo`) : ""}`;
type Row = { key: string; href: string; title: string; company: string; companyId: string; ref: string; group: "draft" | "awaiting" | "signed" | "closed"; label: string; kind: "good" | "warn" | "bad" | "neutral"; at: Date; amount: string };

/** Every agreement in one place, from first draft to signed copy. Not tickets: an agreement is a document that gets signed. */
export default async function Agreements({ searchParams }: { searchParams: Promise<{ show?: string; q?: string; c?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const sp = await searchParams;
  const show = SHOW.find(([id]) => id === sp.show)?.[0] ?? "open";
  const q = sp.q?.trim().toLowerCase(), company = sp.c?.trim() || "";
  const [contracts, proposals] = await Promise.all([
    db.contract.findMany({ where: { workspaceId: ctx.workspaceId }, include: { customer: { select: { displayName: true } }, proposalVersion: { select: { proposalId: true, supersededAt: true, requirements: true } } }, orderBy: { updatedAt: "desc" }, take: 300 }),
    db.proposal.findMany({ where: { workspaceId: ctx.workspaceId }, include: { customer: { select: { displayName: true } }, versions: { select: { number: true, oneOffMinor: true, recurringMinor: true, requirements: true } } }, orderBy: { updatedAt: "desc" }, take: 300 }),
  ]);
  // A signed or waiting contract stands in for its proposal. A withdrawn one does not: the proposal is back to being written, so it must stay visible.
  const live = contracts.filter((c) => !["voided", "declined", "expired"].includes(c.status));
  const covered = new Set(live.map((c) => c.proposalVersion?.proposalId).filter(Boolean));
  // Contracts for a version that was replaced by a newer one are just history, so they are not listed again.
  const shown = contracts.filter((c) => !(c.proposalVersion?.supersededAt && ["voided", "declined", "expired"].includes(c.status)));
  const all: Row[] = [
    ...shown.map((c): Row => {
      const cancelled = !!c.cancelledAt, done = c.status === "completed" && !cancelled, waiting = c.status === "awaiting_signature" || c.status === "draft";
      return { key: c.id, href: `/contracts/${c.id}`, title: c.title, company: c.customer.displayName, companyId: c.customerId, ref: c.reference, group: done ? "signed" : waiting && !cancelled ? "awaiting" : "closed", label: cancelled ? "Cancelled" : done ? "Signed" : waiting ? "Waiting for signature" : c.status === "declined" ? "Declined" : c.status === "expired" ? "Expired" : "Cancelled", kind: done ? "good" : waiting && !cancelled ? "warn" : "bad", at: c.completedAt ?? c.updatedAt, amount: plan(c.oneOffMinor, c.recurringMinor, c.proposalVersion?.requirements) };
    }),
    ...proposals.filter((p) => p.status === "draft" || !covered.has(p.id)).map((p): Row => {
      const v = p.versions.find((x) => x.number === p.currentVersion);
      const draft = p.status === "draft", sent = p.status === "sent";
      return { key: p.id, href: `/proposals/${p.id}`, title: p.title, company: p.customer.displayName, companyId: p.customerId, ref: p.reference, group: draft ? "draft" : sent ? "awaiting" : "closed", label: draft ? "Being written" : sent ? "Waiting for signature" : p.status, kind: draft ? "neutral" : sent ? "warn" : "bad", at: p.updatedAt, amount: v ? plan(v.oneOffMinor, v.recurringMinor, v.requirements) : "" };
    }),
  ];
  const only = (skipShow = false) => all.filter((r) => (skipShow || show === "all" || (show === "open" ? r.group !== "closed" : r.group === show)) && (!company || r.companyId === company) && (!q || `${r.title} ${r.company} ${r.ref}`.toLowerCase().includes(q)));
  const rows = only().sort((a, b) => +b.at - +a.at);
  const count = (id: string) => only(true).filter((r) => id === "all" || (id === "open" ? r.group !== "closed" : r.group === id)).length;
  const companies = [...new Map(all.map((r) => [r.companyId, r.company])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  return (
    <>
      <h1 className="sr-only">Agreements</h1>
      <div className="lt">
        <AutoGetForm className="lt-form">
          <div className="lt-row">
            <label className="lt-search"><span className="sr-only">Search agreements</span><Search size={17} aria-hidden /><input id="q" name="q" type="search" defaultValue={sp.q} placeholder="Name, company or number" autoComplete="off" /></label>
            <input type="hidden" name="show" value={show} />
            <FilterPanel active={company ? 1 : 0}>
              <div className="col-span-full"><label className="label" htmlFor="c">Company</label><select id="c" name="c" defaultValue={company} className="field"><option value="">Any</option>{companies.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></div>
            </FilterPanel>
            <Link className="lt-add" href="/agreements/new" aria-label="New agreement"><Plus size={18} aria-hidden /><span>New agreement</span></Link>
          </div>
        </AutoGetForm>
        <QuickChips label="Show agreements" items={SHOW.map(([id, l]) => ({ label: l, count: count(id), href: `/agreements?show=${id}${company ? `&c=${company}` : ""}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`, on: show === id }))} />
        <p className="lt-count">{rows.length} {rows.length === 1 ? "agreement" : "agreements"}{(show !== "open" || company || q) && <> · <Link href="/agreements" className="underline">Clear</Link></>}</p>
      </div>
      {rows.length === 0 ? <Empty title="No agreements here">{show === "open" ? "Start one from a company, or press New agreement." : "Nothing matches that filter."}</Empty> : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {rows.map((r) => (
            <li key={r.key}><Link href={r.href} className="grid items-center gap-2 px-4 py-3 hover:bg-bone/60 sm:grid-cols-[1fr_auto]">
              <span className="min-w-0"><span className="block truncate font-semibold">{r.title}</span>
                <span className="text-sm text-muted">{r.company} · {r.ref} · {r.amount ? `${r.amount} · ` : ""}{timeAgo(r.at)}</span></span>
              <Status label={r.label} kind={r.kind} />
            </Link></li>
          ))}
        </ul>
      )}
    </>
  );
}
