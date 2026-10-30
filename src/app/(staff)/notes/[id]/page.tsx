import { notFound } from "next/navigation";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { getNote } from "@/modules/notes/service";
import { archivePageAction } from "@/app/actions/notes";
import { NoteEditor } from "@/components/note-editor";

export const metadata = { title: "Notes" };
export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaff();
  const { id } = await params;
  const n = await getNote(ctx, id);
  if (!n) notFound();
  const mine = n.ownerId === ctx.staffId;
  return (
    <>
      <NoteEditor key={n.id} id={n.id} mine={mine} canWrite={can(ctx.role, "notes.write")} initial={{ title: n.title, body: n.body, version: n.version, visibility: n.visibility === "private" ? "private" : "team" }} />
      {(mine || ctx.role === "owner") && (
        <form action={archivePageAction} className="mx-auto mt-16 max-w-3xl border-t border-line pt-4"><input type="hidden" name="id" value={n.id} />
          <button className="text-sm text-muted underline hover:text-danger">Move this page to the archive</button></form>
      )}
    </>
  );
}
