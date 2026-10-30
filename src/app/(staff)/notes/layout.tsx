import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { visibleNotes } from "@/modules/notes/service";
import { NotesShell } from "@/components/notes-shell";

export default async function NotesLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStaff();
  const rows = await db.note.findMany({ where: visibleNotes(ctx), orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }], take: 300, select: { id: true, title: true, body: true, updatedAt: true, visibility: true } });
  const items = rows.map((n) => ({ id: n.id, title: n.title, snippet: n.body.replace(/[#>*\-\[\]`]/g, " ").replace(/\s+/g, " ").trim().slice(0, 70), updatedAt: n.updatedAt.toISOString(), visibility: n.visibility }));
  return <NotesShell items={items} canWrite={can(ctx.role, "notes.write")}>{children}</NotesShell>;
}
