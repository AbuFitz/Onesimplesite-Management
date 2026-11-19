import Link from "next/link";
import { Search, Users, Plus } from "lucide-react";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { listCustomers, customerStatusCounts, LIFECYCLE, LIFECYCLE_KEYS, type LifecycleKey } from "@/modules/crm/service";
import { RecordHeader, Status, Empty, Avatar, timeAgo } from "@/components/ui";
import { AutoGetForm } from "@/components/auto-form";
import { QuickChips, FilterPanel, AppliedChips } from "@/components/filter-bar";

export const metadata = { title: "Companies" };
type SP = { q?: string; page?: string; mine?: string; status?: string; risk?: string; sort?: string; archived?: string; deleted?: string };
const SORTS = [["new", "Newest first"], ["recent", "Recently updated"], ["name", "A to Z"]] as const;

export default async function Customers({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireStaff("customer.read");
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const status = sp.status === "archived" || (LIFECYCLE_KEYS as string[]).includes(String(sp.status)) ? String(sp.status) : "all";
  const sort = SORTS.find(([id]) => id === sp.sort)?.[0] ?? "new";
  const filter = { search: sp.q?.trim() || undefined, mine: sp.mine === "1", atRisk: sp.risk === "1", sort };
  const [{ rows, total, pages }, counts] = await Promise.all([listCustomers(ctx, { ...filter, status: status === "all" ? undefined : status, page }), customerStatusCounts(ctx, filter)]);
  const href = (o: Partial<{ status: string; mine: string; risk: string; sort: string; page: number }> = {}) => {
    const p = new URLSearchParams();
    const v = { status, mine: sp.mine ?? "", risk: sp.risk ?? "", sort: sp.sort ?? "", ...o };
    if (sp.q) p.set("q", sp.q);
    if (v.status && v.status !== "all") p.set("status", v.status);
    if (v.mine) p.set("mine", "1"); if (v.risk) p.set("risk", "1"); if (v.sort && v.sort !== "new") p.set("sort", v.sort);
    if (o.page && o.page > 1) p.set("page", String(o.page));
    const q = p.toString(); return `/customers${q ? `?${q}` : ""}`;
  };
  const active = [sp.mine === "1", sp.risk === "1", sort !== "new", !!sp.q].filter(Boolean).length;
  const chips = [
    { href: href({ status: "all", page: 1 }), label: "All", count: counts.all, active: status === "all" },
    ...LIFECYCLE_KEYS.map((k) => ({ href: href({ status: k, page: 1 }), label: LIFECYCLE[k].label, count: counts[k], active: status === k })),
    { href: href({ status: "archived", page: 1 }), label: "Archived", count: counts.archived, active: status === "archived" },
  ];
  return (
    <>
      <h1 className="sr-only">Companies</h1>
      {sp.archived && <p role="status" className="mb-4 rounded-lg bg-[#e9f6ef] px-4 py-3 text-sm font-semibold text-[#0a5a3d]">Company archived. You can restore it from here any time.</p>}
      {sp.deleted && <p role="status" className="mb-4 rounded-lg bg-[#e9f6ef] px-4 py-3 text-sm font-semibold text-[#0a5a3d]">Company deleted.</p>}

      <div className="lt">
        <AutoGetForm className="lt-form">
          <div className="lt-row">
            <label className="lt-search"><span className="sr-only">Search companies</span><Search size={17} aria-hidden /><input id="q" name="q" type="search" defaultValue={sp.q} placeholder="Search by name, reference, person or email" autoComplete="off" /></label>
            <FilterPanel active={[sort !== "new", sp.mine === "1", sp.risk === "1"].filter(Boolean).length}>
              <div className="col-span-full"><label className="label" htmlFor="sort">Sort by</label>
                <select id="sort" name="sort" defaultValue={sort} className="field">{SORTS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></div>
              <label className="grp grp-row col-span-full" htmlFor="f-mine"><span>Mine</span><span className="sw"><input id="f-mine" type="checkbox" name="mine" value="1" defaultChecked={sp.mine === "1"} /><i aria-hidden /></span></label>
              <label className="grp grp-row col-span-full" htmlFor="f-risk"><span>At risk{counts.atRisk ? <small className="ml-2 text-muted">{counts.atRisk}</small> : null}</span><span className="sw"><input id="f-risk" type="checkbox" name="risk" value="1" defaultChecked={sp.risk === "1"} /><i aria-hidden /></span></label>
            </FilterPanel>
            {can(ctx.role, "customer.write") && <Link href="/customers/new" className="lt-add" aria-label="Add a company"><Plus size={18} aria-hidden /><span>Add a company</span></Link>}
          </div>
          <div className="sr-only"><label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={status}>{chips.map((c) => <option key={c.label} value={c.label === "All" ? "all" : c.label === "On hold" ? "paused" : c.label.toLowerCase()}>{c.label} ({c.count})</option>)}</select></div>
        </AutoGetForm>
        <QuickChips label="Company status" items={chips.map((c) => ({ label: c.label, count: c.count, href: c.href, on: c.active }))} />
        <AppliedChips clearHref={status !== "all" ? `/customers?status=${status}` : "/customers"} items={[
          ...(sp.mine === "1" ? [{ label: "Owner", value: "Mine", href: href({ mine: "" }) }] : []),
          ...(sp.risk === "1" ? [{ label: "Health", value: "At risk", href: href({ risk: "" }) }] : []),
          ...(sort !== "new" ? [{ label: "Sort", value: SORTS.find(([id]) => id === sort)?.[1] ?? sort, href: href({ sort: "" }) }] : []),
          ...(sp.q ? [{ label: "Search", value: sp.q, href: href().replace(/([?&])q=[^&]*&?/, "$1").replace(/[?&]$/, "") }] : []),
        ]} />
        <p className="lt-count">{total} {total === 1 ? "company" : "companies"}</p>
      </div>

      {rows.length === 0 ? (
        <Empty title={active || status !== "all" ? "No companies match" : "No companies yet"}>{active || status !== "all" ? <Link className="underline" href="/customers">Show everything</Link> : <Link className="underline" href="/customers/new">Add your first company</Link>}</Empty>
      ) : (
        <div>
          <div className="thead hidden grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_10rem_7rem] gap-4 px-4 pb-2 md:grid"><span>Company</span><span>Primary contact</span><span>Status</span><span className="text-right">Added</span></div>
          <ul className="list-card">
            {rows.map((c) => {
              const l = LIFECYCLE[c.lifecycle as LifecycleKey];
              return (
                <li key={c.id} className="row">
                  <Link href={`/customers/${c.id}`} className="grid min-h-16 items-center gap-x-4 gap-y-1.5 py-3 hover:bg-soft md:grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_10rem_7rem] md:rounded-lg md:px-3">
                    <span className="flex min-w-0 items-center gap-3"><Avatar name={c.displayName} staffId={c.id} base="/api/logo" /><span className="min-w-0"><span className="block truncate font-medium">{c.displayName}</span><span className="block text-xs text-muted">{c.reference}{c.town ? ` · ${c.town}` : ""}</span></span></span>
                    <span className="min-w-0 truncate text-sm text-muted">{c.contacts[0] ? `${c.contacts[0].name}${c.contacts[0].email ? ` · ${c.contacts[0].email}` : ""}` : "No contact"}</span>
                    <span className="flex flex-wrap items-center gap-1.5"><Status label={l?.label ?? c.lifecycle} kind={l?.kind ?? "neutral"} />{c.atRisk && <Status label="at risk" kind="bad" />}{c.archivedAt && <Status label="Archived" kind="neutral" />}</span>
                    <span className="text-sm text-muted md:text-right">{timeAgo(c.createdAt)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? <Link className="btn btn-quiet" href={href({ page: page - 1 })}>Previous</Link> : <span />}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages ? <Link className="btn btn-quiet" href={href({ page: page + 1 })}>Next</Link> : <span />}
        </nav>
      )}
      {total === 0 && rows.length === 0 && <span className="sr-only"><Users aria-hidden /></span>}
    </>
  );
}
