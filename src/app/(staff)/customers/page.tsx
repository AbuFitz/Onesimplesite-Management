import Link from "next/link";
import { requireStaff } from "@/modules/identity/session";
import { listCustomers } from "@/modules/crm/service";
import { RecordHeader, Status, Empty } from "@/components/ui";

export const metadata = { title: "Customers" };
type SP = { q?: string; page?: string; mine?: string; error?: string };

export default async function Customers({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireStaff("customer.read");
  const sp = await searchParams;
  const { rows, total, pages } = await listCustomers(ctx, { search: sp.q, page: Number(sp.page) || 1, mine: sp.mine === "1" });
  const page = Number(sp.page) || 1;
  const qs = (p: number) => `?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.mine ? { mine: "1" } : {}), page: String(p) })}`;
  return (
    <>
      <RecordHeader title="Customers" meta={`${total} total`} action={<Link href="/customers/new" className="btn">New enquiry</Link>} />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <label className="sr-only" htmlFor="q">Search customers</label>
        <input id="q" name="q" defaultValue={sp.q} placeholder="Search name, reference or email" className="field max-w-sm" />
        <label className="flex items-center gap-2 min-h-11 text-sm"><input type="checkbox" name="mine" value="1" defaultChecked={sp.mine === "1"} /> Assigned to me</label>
        <button className="btn btn-quiet">Search</button>
      </form>
      {rows.length === 0 ? <Empty title={sp.q || sp.mine ? "No customers match these filters" : "No customers yet"}><Link className="underline" href="/customers/new">Record the first enquiry</Link></Empty> : (
        <ul>
          {rows.map((c) => (
            <li key={c.id} className="row">
              <Link href={`/customers/${c.id}`} className="grid gap-1 py-3 px-1 hover:bg-wash sm:grid-cols-[1fr_1fr_8rem] sm:items-center">
                <span className="min-w-0"><strong className="break-words">{c.displayName}</strong><span className="block text-xs text-muted">{c.reference}</span></span>
                <span className="text-sm text-muted break-all">{c.contacts[0]?.name}{c.contacts[0]?.email ? ` · ${c.contacts[0].email}` : ""}</span>
                <Status label={c.lifecycle} kind={c.lifecycle === "active" ? "good" : "neutral"} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <nav aria-label="Pagination" className="mt-6 flex items-center gap-4 text-sm">
        {page > 1 && <Link className="btn btn-quiet" href={qs(page - 1)}>Previous</Link>}
        <span>Page {page} of {pages}</span>
        {page < pages && <Link className="btn btn-quiet" href={qs(page + 1)}>Next</Link>}
      </nav>
    </>
  );
}
