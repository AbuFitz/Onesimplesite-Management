import Link from "next/link";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { listCustomers } from "@/modules/crm/service";
import { RecordHeader, Status, Empty, Avatar, timeAgo } from "@/components/ui";

export const metadata = { title: "Customers" };
type SP = { q?: string; page?: string; mine?: string };

export default async function Customers({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireStaff("customer.read");
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const { rows, total, pages } = await listCustomers(ctx, { search: sp.q, page, mine: sp.mine === "1" });
  const qs = (p: number) => `?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.mine ? { mine: "1" } : {}), page: String(p) })}`;
  return (
    <>
      <RecordHeader title="Customers" meta={`${total} ${total === 1 ? "customer" : "customers"}`} action={can(ctx.role, "customer.write") ? <Link href="?new=ticket" className="btn">New ticket</Link> : undefined} />
      <form className="mb-6 flex flex-wrap items-center gap-3" role="search">
        <label className="sr-only" htmlFor="q">Search customers</label>
        <input id="q" name="q" type="search" defaultValue={sp.q} placeholder="Search by name, reference or email" className="field max-w-sm" />
        <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" name="mine" value="1" defaultChecked={sp.mine === "1"} className="size-4" /> Mine only</label>
        <button className="btn btn-quiet">Search</button>
      </form>
      {rows.length === 0 ? (
        <Empty title={sp.q || sp.mine ? "No customers match" : "No customers yet"}>{sp.q || sp.mine ? "Try a different search." : <Link className="underline" href="?new=ticket">Record your first enquiry</Link>}</Empty>
      ) : (
        <div>
          <div className="thead hidden grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_9rem_8rem] gap-4 px-3 pb-2 md:grid"><span>Customer</span><span>Primary contact</span><span>Status</span><span className="text-right">Added</span></div>
          <ul>
            {rows.map((c) => (
              <li key={c.id} className="row">
                <Link href={`/customers/${c.id}`} className="grid min-h-16 items-center gap-x-4 gap-y-1 py-3 hover:bg-soft md:grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_9rem_8rem] md:rounded-lg md:px-3">
                  <span className="flex min-w-0 items-center gap-3"><Avatar name={c.displayName} /><span className="min-w-0"><span className="block truncate font-medium">{c.displayName}</span><span className="block text-xs text-muted">{c.reference}</span></span></span>
                  <span className="min-w-0 truncate text-sm text-muted">{c.contacts[0] ? `${c.contacts[0].name}${c.contacts[0].email ? ` · ${c.contacts[0].email}` : ""}` : "No contact"}</span>
                  <span><Status label={c.lifecycle} kind={c.lifecycle === "active" ? "good" : "neutral"} /></span>
                  <span className="text-sm text-muted md:text-right">{timeAgo(c.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? <Link className="btn btn-quiet" href={qs(page - 1)}>Previous</Link> : <span />}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages ? <Link className="btn btn-quiet" href={qs(page + 1)}>Next</Link> : <span />}
        </nav>
      )}
    </>
  );
}
