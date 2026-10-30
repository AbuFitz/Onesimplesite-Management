import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { visibleNotes } from "@/modules/notes/service";
import { createNoteAction } from "@/app/actions/work";
import { RecordHeader, Empty, ErrorSummary, Status, fmtDateTime } from "@/components/ui";

export const metadata = { title: "Notes" };
export default async function Notes({ searchParams }: { searchParams: Promise<{ q?: string; error?: string }> }) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const rows = await db.note.findMany({
    where: { AND: [visibleNotes(ctx), sp.q ? { OR: [{ title: { contains: sp.q, mode: "insensitive" } }, { body: { contains: sp.q, mode: "insensitive" } }] } : {}] },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }], take: 100,
  });
  return (
    <>
      <RecordHeader title="Notes" />
      <ErrorSummary message={sp.error} />
      <form role="search" className="mb-4 flex gap-2"><label className="sr-only" htmlFor="q">Search notes</label><input id="q" name="q" defaultValue={sp.q} className="field max-w-sm" placeholder="Search notes" /><button className="btn btn-quiet">Search</button></form>
      {rows.length === 0 ? <Empty title={sp.q ? "No notes match" : "No notes yet"} /> : <ul>{rows.map((n) => <li key={n.id} className="row"><Link href={`/notes/${n.id}`} className="flex justify-between gap-3 py-3 min-h-12 hover:bg-wash px-1"><span className="break-words">{n.title}</span><span className="text-xs text-muted shrink-0">{n.visibility === "private" && <Status label="private" />} {fmtDateTime(n.updatedAt)}</span></Link></li>)}</ul>}
      <form action={createNoteAction} className="mt-10 max-w-xl space-y-3"><h2>New note</h2>
        <div><label className="label" htmlFor="nt">Title</label><input id="nt" name="title" className="field" required /></div>
        <label className="flex items-center gap-2 min-h-11 text-sm"><input type="radio" name="visibility" value="team" defaultChecked /> Team</label>
        <label className="flex items-center gap-2 min-h-11 text-sm"><input type="radio" name="visibility" value="private" /> Only me</label>
        <button className="btn">Create note</button></form>
    </>
  );
}
