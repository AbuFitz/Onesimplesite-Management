import Link from "next/link";
import { MessageCircle, Pin, Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { listPosts, visibleNotes, type BoardFilter } from "@/modules/notes/service";
import { NewTopic, VisBadge } from "@/components/board-ui";
import { Avatar, Empty, timeAgo } from "@/components/ui";
import { AutoGetForm } from "@/components/auto-form";
import { QuickChips } from "@/components/filter-bar";

export const metadata = { title: "Team Board" };
const FILTERS: [BoardFilter, string][] = [["all", "Everything"], ["pinned", "Pinned"], ["mine", "Mine"], ["private", "Only me"]];
const plain = (b: string) => b.replace(/^[#>\-*\s]+/gm, "").replace(/\*\*|`|\[|\]\(https?:[^)]*\)/g, "").replace(/\s+/g, " ").trim();

export default async function Board({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const filter = (FILTERS.find(([id]) => id === sp.f)?.[0] ?? "all") as BoardFilter;
  const [posts, comments] = await Promise.all([
    listPosts(ctx, { q: sp.q, filter }),
    db.noteComment.findMany({ where: { workspaceId: ctx.workspaceId, note: visibleNotes(ctx) }, orderBy: { createdAt: "desc" }, take: 6, include: { note: { select: { id: true, title: true } } } }),
  ]);
  const authors = new Map((await db.staffMembership.findMany({ where: { id: { in: comments.map((c) => c.authorId) } }, select: { id: true, displayName: true } })).map((a) => [a.id, a.displayName]));
  const href = (f: string) => `/board?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(f !== "all" ? { f } : {}) }).toString()}`;
  return (
    <>
      <h1 className="sr-only">Team Board</h1>
      <div className="lt">
        <AutoGetForm className="lt-form">
          <div className="lt-row">
            <label className="lt-search"><span className="sr-only">Search the board</span><Search size={17} aria-hidden /><input id="bq" name="q" type="search" defaultValue={sp.q} placeholder="Search topics" autoComplete="off" /></label>
            {filter !== "all" && <input type="hidden" name="f" value={filter} />}
            {can(ctx.role, "notes.write") && <NewTopic name={ctx.name} staffId={ctx.staffId} />}
          </div>
        </AutoGetForm>
        <QuickChips label="Show" items={FILTERS.map(([id, l]) => ({ label: l, href: href(id), on: filter === id }))} />
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {posts.length === 0 ? <Empty title={sp.q ? "No topics match" : "Quiet in here"}>{sp.q ? "Try a different word." : "Start the first topic."}</Empty> : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
            {posts.map((p) => (
              <li key={p.id}>
                <Link href={`/board/${p.id}`} className="flex items-start gap-3 px-4 py-3.5 hover:bg-bone/60">
                  <Avatar name={p.author.displayName} size={36} staffId={p.author.id} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2"><span className="truncate font-semibold">{p.title}</span>{p.pinned && <Pin size={13} className="shrink-0 text-olive-700" aria-label="Pinned" />}<VisBadge v={p.visibility} /></span>
                    {plain(p.body) && <span className="mt-0.5 block line-clamp-1 text-[14.5px] text-muted">{plain(p.body)}</span>}
                    <span className="mt-1 block text-[13px] text-muted">{p.author.displayName} · {timeAgo(p.updatedAt)}</span>
                  </span>
                  <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-soft px-2.5 py-1 text-[13px] font-semibold text-ink/80" aria-label={`${p._count.comments} replies`}><MessageCircle size={14} aria-hidden />{p._count.comments}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <aside className="hidden xl:block">
          <section className="rounded-2xl border border-line bg-white p-4">
            <h2 className="mb-1 text-base font-bold">Latest replies</h2>
            {comments.length === 0 ? <p className="text-sm text-muted">None yet.</p> : <ul className="divide-y divide-[var(--card-rule)]">{comments.map((c) => <li key={c.id}><Link href={`/board/${c.note.id}`} className="block py-2.5"><span className="block line-clamp-2 text-[14px]">{c.body}</span><span className="text-[13px] text-muted">{authors.get(c.authorId) ?? "Someone"} · {c.note.title} · {timeAgo(c.createdAt)}</span></Link></li>)}</ul>}
          </section>
        </aside>
      </div>
    </>
  );
}
