import Link from "next/link";
import { Building2, User, FileText, ScrollText, FolderKanban, Ticket, MessagesSquare, Search as SearchIcon, type LucideIcon } from "lucide-react";
import { requireStaff } from "@/modules/identity/session";
import { searchAll } from "@/modules/search/service";
import { RecordHeader, Empty } from "@/components/ui";
import { Panel } from "@/components/panel";

export const metadata = { title: "Search" };
const ICON: Record<string, LucideIcon> = { business: Building2, person: User, quote: FileText, agreement: ScrollText, project: FolderKanban, ticket: Ticket, board: MessagesSquare };

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireStaff();
  const { q = "" } = await searchParams;
  const r = await searchAll(ctx, q);
  const total = r.groups.reduce((n, g) => n + g.items.length, 0);
  return (
    <>
      <RecordHeader title="Search" meta="Tip: press ⌘K (or Ctrl+K) anywhere to search without leaving the page" />
      <form role="search" className="relative mb-6 max-w-2xl"><SearchIcon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden /><label htmlFor="q" className="sr-only">Search</label>
        <input id="q" name="q" defaultValue={q} autoFocus type="search" placeholder="A business, person, ticket, agreement, project or post" className="field !min-h-12 !pl-11 !text-base" /></form>
      {r.q.length < 2 ? <p className="text-ink/70">Type at least two letters. You can search by reference number too, like OSS-TK-2026-0004.</p>
        : r.groups.length === 0 ? <Empty title={`No results for “${r.q}”`}>Check the spelling, or search by reference number. You only see records you have access to.</Empty>
        : (
          <>
            <p className="mb-4 text-sm text-ink/70">{total} result{total === 1 ? "" : "s"} for “{r.q}”</p>
            <div className="grid items-start gap-5 lg:grid-cols-2">
              {r.groups.map((g) => (
                <Panel key={g.title} title={g.title} icon={ICON[g.kind]} action={<span className="text-sm font-semibold text-ink/60">{g.items.length}</span>}>
                  <ul className="-my-1 divide-y divide-[var(--card-rule)]">{g.items.map((i) => <li key={i.href + i.title}><Link href={i.href} className="block py-2.5 hover:text-moss"><span className="block font-semibold">{i.title}</span><span className="block text-[13px] text-ink/65">{i.sub}</span></Link></li>)}</ul>
                </Panel>
              ))}
            </div>
          </>
        )}
    </>
  );
}
