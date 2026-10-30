import { notFound } from "next/navigation";
import { requireStaff } from "@/modules/identity/session";
import { getNote } from "@/modules/notes/service";
import { saveNoteAction, archiveNoteAction } from "@/app/actions/work";
import { RecordHeader, ErrorSummary } from "@/components/ui";

export const metadata = { title: "Note" };
export default async function NotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const ctx = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const n = await getNote(ctx, id);
  if (!n) notFound();
  return (
    <>
      <RecordHeader back={{ href: "/notes", label: "Notes" }} title={n.title} meta={n.visibility === "private" ? "Private to you" : "Shared with the team"} />
      <ErrorSummary message={sp.error} />
      {sp.saved && <p role="status" className="mb-3 text-sm text-moss">Saved.</p>}
      <form action={saveNoteAction} className="max-w-3xl space-y-3"><input type="hidden" name="id" value={n.id} /><input type="hidden" name="version" value={n.version} />
        <div><label className="label" htmlFor="t">Title</label><input id="t" name="title" className="field" defaultValue={n.title} required /></div>
        <div><label className="label" htmlFor="b">Note</label><textarea id="b" name="body" className="field min-h-[50dvh]" defaultValue={n.body} /></div>
        {n.ownerId === ctx.staffId && <div><label className="label" htmlFor="v">Visibility</label><select id="v" name="visibility" className="field w-auto" defaultValue={n.visibility}><option value="team">Team</option><option value="private">Only me</option></select></div>}
        <p className="hint">Plain text for now; if someone else saved first you will be told rather than overwriting their edit. No passwords or secrets in notes.</p>
        <button className="btn">Save</button></form>
      <form action={archiveNoteAction} className="mt-6"><input type="hidden" name="id" value={n.id} /><button className="btn btn-quiet">Archive note</button></form>
    </>
  );
}
