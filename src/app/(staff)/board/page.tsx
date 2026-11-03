import Link from "next/link";
import { MessageCircle, Pin, MessagesSquare, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { listPosts, visibleNotes, type BoardFilter } from "@/modules/notes/service";
import { Composer, VisBadge } from "@/components/board-ui";
import { Avatar, RecordHeader, Empty, timeAgo } from "@/components/ui";
import { Panel } from "@/components/panel";

export const metadata = { title: "Team Board" };
const FILTERS: [BoardFilter, string][] = [["all", "Everything"], ["pinned", "Pinned"], ["mine", "My posts"], ["private", "Only me"]];
const plain = (b: string) => b.replace(/^[#>\-*\s]+/gm, "").replace(/\*\*|`|\[|\]\(https?:[^)]*\)/g, "").replace(/\s+/g, " ").trim();

export default async function Board({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const filter = (FILTERS.find(([id]) => id === sp.f)?.[0] ?? "all") as BoardFilter;
  const [posts, pinned, comments] = await Promise.all([
    listPosts(ctx, { q: sp.q, filter }),
    listPosts(ctx, { filter: "pinned" }),
    db.noteComment.findMany({ where: { workspaceId: ctx.workspaceId, note: visibleNotes(ctx) }, orderBy: { createdAt: "desc" }, take: 5, include: { note: { select: { id: true, title: true } } } }),
  ]);
  const authors = new Map((await db.staffMembership.findMany({ where: { id: { in: comments.map((c) => c.authorId) } }, select: { id: true, displayName: true } })).map((a) => [a.id, a.displayName]));
  const href = (f: string) => `/board?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), f }).toString()}`;
  return (
    <>
      <RecordHeader title="Team Board" meta="Updates, wins, questions and how-tos from the team" />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0">
        {can(ctx.role, "notes.write") && <Composer name={ctx.name} />}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Filter posts" className="flex flex-wrap gap-2">{FILTERS.map(([id, label]) => <Link key={id} href={href(id)} aria-current={filter === id ? "page" : undefined} className={`btn !min-h-9 ${filter === id ? "" : "btn-quiet"}`}>{label}</Link>)}</nav>
          <form role="search" className="flex gap-2"><input type="hidden" name="f" value={filter} /><label className="sr-only" htmlFor="bq">Search the board</label><input id="bq" name="q" defaultValue={sp.q} className="field !min-h-9 w-44 !text-sm" placeholder="Search" /></form>
        </div>
        {posts.length === 0 ? <Empty title={sp.q ? "No posts match" : "Nothing here yet"}>{sp.q ? "Try a different word." : "Be the first to post something."}</Empty> : (
          <ul className="space-y-3">
            {posts.map((p) => (
              <li key={p.id}>
                <Link href={`/board/${p.id}`} className="block rounded-xl border border-[var(--card-line)] bg-white p-5 transition-colors hover:bg-[var(--color-soft)]">
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
      <aside className="space-y-5">
        <Panel title="Pinned" icon={Pin}>
          {pinned.length === 0 ? <p className="text-[14px] text-ink/70">Nothing pinned. Pin a post and it stays here for everyone.</p> : <ul className="-my-1 divide-y divide-[var(--card-rule)]">{pinned.slice(0, 5).map((p) => <li key={p.id}><Link href={`/board/${p.id}`} className="block py-2.5"><span className="block truncate font-semibold hover:underline">{p.title}</span><span className="text-[13px] text-ink/65">{p.author.displayName} · {timeAgo(p.updatedAt)}</span></Link></li>)}</ul>}
        </Panel>
        <Panel title="Latest comments" icon={MessagesSquare}>
          {comments.length === 0 ? <p className="text-[14px] text-ink/70">No comments yet.</p> : <ul className="-my-1 divide-y divide-[var(--card-rule)]">{comments.map((c) => <li key={c.id}><Link href={`/board/${c.note.id}`} className="block py-2.5"><span className="block line-clamp-2 text-[14px]">{c.body}</span><span className="text-[13px] text-ink/65">{authors.get(c.authorId) ?? "Someone"} on “{c.note.title}” · {timeAgo(c.createdAt)}</span></Link></li>)}</ul>}
        </Panel>
        <Panel title="How to use the board" icon={Users}><ul className="list-disc space-y-1.5 pl-5 text-[14px] text-ink/80"><li>Post wins, updates, questions and how-tos.</li><li>Choose “Only me” for private notes.</li><li>Tick to-dos inside a post and it saves for everyone.</li></ul></Panel>
      </aside>
      </div>
    </>
  );
}
