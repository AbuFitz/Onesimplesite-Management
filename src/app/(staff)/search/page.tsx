import Link from "next/link";
import { requireStaff } from "@/modules/identity/session";
import { searchAll } from "@/modules/search/service";
import { RecordHeader, Empty } from "@/components/ui";

export const metadata = { title: "Search" };
export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireStaff();
  const { q = "" } = await searchParams;
  const r = await searchAll(ctx, q);
  return (
    <>
      <RecordHeader title="Search" />
      <form role="search" className="mb-8 max-w-xl"><label htmlFor="q" className="sr-only">Search</label><input id="q" name="q" defaultValue={q} autoFocus type="search" placeholder="Customer, contact, agreement, project or note" className="field" /></form>
      {r.q.length < 2 ? <p className="text-muted">Type at least two characters.</p> : r.groups.length === 0 ? <Empty title={`No results for “${r.q}”`}>Check the spelling, or search by reference number. You only see records you have access to.</Empty> : (
        r.groups.map((g) => (
          <section key={g.title} className="mb-8 max-w-2xl"><h2 className="mb-1">{g.title}</h2>
            <ul>{g.items.map((i) => <li key={i.href + i.title} className="row"><Link href={i.href} className="block min-h-12 py-3 hover:bg-soft sm:-mx-3 sm:rounded-lg sm:px-3"><span className="font-medium">{i.title}</span><span className="block text-sm text-muted">{i.sub}</span></Link></li>)}</ul>
          </section>
        ))
      )}
    </>
  );
}
