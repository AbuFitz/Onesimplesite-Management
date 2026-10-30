import { db } from "@/lib/db";
import { getStaff } from "@/modules/identity/session";
import { toIcs } from "@/modules/calendar/service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getStaff();
  if (!ctx) return new Response("Unauthorised", { status: 401 });
  const { id } = await params;
  const e = await db.calendarEvent.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: { attendees: true } });
  if (!e) return new Response("Not found", { status: 404 });
  const org = await db.staffMembership.findUnique({ where: { id: e.organiserId } });
  return new Response(toIcs(e, org?.email ?? "hello@onesimplesite.co.uk"), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="event.ics"` } });
}
