import Link from "next/link";
import { MessageCircle, Pin } from "lucide-react";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { listPosts, type BoardFilter } from "@/modules/notes/service";
import { Composer, VisBadge } from "@/components/board-ui";
import { Avatar, RecordHeader, Empty, timeAgo } from "@/components/ui";

export const metadata = { title: "Team Board" };
const FILTERS: [BoardFilter, string][] = [["all", "Everything"], ["pinned", "Pinned"], ["mine", "My posts"], ["private", "Only me"]];
const plain = (b: string) => b.replace(/^[#>\-*\s]+/gm, "").replace(/\*\*|`|\[|\]\(https?:[^)]*\)/g, "").replace(/\s+/g, " ").trim();

export default async function Board({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const filter = (FILTERS.find(([id]) => id === sp.f)?.[0] ?? "all") as BoardFilter;
  const posts = await listPosts(ctx, { q: sp.q, filter });
  const href = (f: string) => `/board?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), f }).toString()}`;
  return (
    <>
      <RecordHeader title="Team Board" meta="Updates, wins, questions and how-tos from the team" />
      <div className="mx-auto max-w-3xl">
        {can(ctx.role, "notes.write") && <Composer name={ctx.name} />}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Filter posts" className="flex flex-wrap gap-2">{FILTERS.map(([id, label]) => <Link key={id} href={href(id)} aria-current={filter === id ? "page" : undefined} className={`btn !min-h-9 ${filter === id ? "" : "btn-quiet"}`}>{label}</Link>)}</nav>
          <form role="search" className="flex gap-2"><input type="hidden" name="f" value={filter} /><label className="sr-only" htmlFor="bq">Search the board</label><input id="bq" name="q" defaultValue={sp.q} className="field !min-h-9 w-44 !text-sm" placeholder="Search" /></form>
        </div>
        {posts.length === 0 ? <Empty title={sp.q ? "No posts match" : "Nothing here yet"}>{sp.q ? "Try a different word." : "Be the first to post something."}</Empty> : (
          <ul className="space-y-3">
            {posts.map((p) => (
              <li key={p.id}>
                <Link href={`/board/${p.id}`} className="block rounded-2xl border border-line bg-white p-5 transition-shadow hover:shadow-[0_4px_18px_rgba(14,19,17,.07)]">
                  <div className="flex items-center gap-3">
                    <Avatar name={p.author.displayName} size={36} />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{p.author.displayName}{p.author.jobTitle && <span className="font-normal text-muted"> · {p.author.jobTitle}</span>}</p><p className="text-xs text-muted">{timeAgo(p.updatedAt)}</p></div>
                    <div className="flex items-center gap-2">{p.pinned && <span className="inline-flex items-center gap-1 rounded-full bg-[#fbf3d5] px-2 py-0.5 text-xs text-[#6b5200]"><Pin size={11} aria-hidden />Pinned</span>}<VisBadge v={p.visibility} /></div>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold leading-snug">{p.title}</h2>
                  {plain(p.body) && <p className="mt-1 line-clamp-3 text-[15px] text-muted">{plain(p.body)}</p>}
                  <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted"><MessageCircle size={15} aria-hidden />{p._count.comments === 0 ? "Be the first to comment" : `${p._count.comments} comment${p._count.comments > 1 ? "s" : ""}`}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
