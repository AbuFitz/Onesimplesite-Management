// Local-only: adds project tasks and files to the demo business so the project pages can be reviewed.
import { db } from "@/lib/db";
import { seedStageTasks, addProjectFiles, setTaskDone } from "@/modules/projects/service";
import { createEvent } from "@/modules/calendar/service";
import type { StaffCtx } from "@/modules/identity/session";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
async function main() {
  const m = await db.staffMembership.findFirstOrThrow({ where: { email: "demo.owner@example.test" } });
  const ctx: StaffCtx = { userId: m.userId as string, staffId: m.id, workspaceId: m.workspaceId, role: m.role, name: m.displayName, email: m.email };
  const p = await db.project.findFirstOrThrow({ where: { workspaceId: ctx.workspaceId, customer: { displayName: "Test Client (demo)" } } });
  await db.project.update({ where: { id: p.id }, data: { dueDate: new Date(Date.now() + 20 * 864e5), ownerId: ctx.staffId } });
  await seedStageTasks(ctx, p.id);
  const t = await db.task.findFirst({ where: { projectId: p.id }, orderBy: { createdAt: "asc" } }); if (t) await setTaskDone(ctx, t.id, true);
  await addProjectFiles(ctx, p.id, [{ name: "homepage-design.png", type: "image/png", bytes: PNG }, { name: "brand-colours.pdf", type: "application/pdf", bytes: Buffer.from("%PDF-1.4\n%demo") }], { folder: "Design", shared: true });
  await addProjectFiles(ctx, p.id, [{ name: "internal-notes.txt", type: "text/plain", bytes: Buffer.from("Hana prefers calls after 2pm.") }], { shared: false });
  const day = (n: number, h = 10) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d; };
  for (const [n, h, title] of [[0, 11, "Call with Hana Baker"], [1, 14, "Design review: Test Client"], [3, 9, "Team stand-up"], [5, 15, "Launch check"], [-2, 10, "Kick-off"]] as const) await createEvent(ctx, { title, type: "client_call", startsAt: day(n, h), endsAt: day(n, h + 1), attendeeIds: [] }).catch(() => undefined);
  console.log("ok"); process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
