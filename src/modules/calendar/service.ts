import { z } from "zod";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { DomainError, forbidden, notFound, stale } from "@/lib/errors";
import { can } from "@/modules/identity/permissions";
import type { StaffCtx } from "@/modules/identity/session";

const eventInput = z.object({
  title: z.string().trim().min(1).max(200),
  type: z.enum(["internal_meeting", "client_call", "review", "focus", "other"]).default("internal_meeting"),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  location: z.string().trim().max(300).optional(),
  description: z.string().trim().max(5000).optional(),
  customerId: z.uuid().optional().or(z.literal("")),
  attendeeIds: z.array(z.uuid()).default([]),
});

export async function createEvent(ctx: StaffCtx, raw: unknown) {
  if (!can(ctx.role, "calendar.write")) throw forbidden();
  const i = eventInput.parse(raw);
  if (i.endsAt <= i.startsAt) throw new DomainError("validation", "End must be after start.");
  return db.$transaction(async (tx) => {
    if (i.customerId) {
      const c = await tx.customer.findFirst({ where: { id: i.customerId, workspaceId: ctx.workspaceId } });
      if (!c) throw notFound("Customer not found.");
    }
    const members = await tx.staffMembership.findMany({ where: { workspaceId: ctx.workspaceId, id: { in: i.attendeeIds }, status: "active" } });
    const ev = await tx.calendarEvent.create({
      data: {
        workspaceId: ctx.workspaceId, organiserId: ctx.staffId, title: i.title, type: i.type, startsAt: i.startsAt, endsAt: i.endsAt,
        location: i.location || null, description: i.description || null, customerId: i.customerId || null, icsUid: `${randomUUID()}@onesimplesite.co.uk`,
        attendees: { create: members.map((m) => ({ staffId: m.id })) },
      },
    });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "event.created", targetType: "event", targetId: ev.id, customerId: ev.customerId });
    return ev;
  });
}

/** Cancelling keeps the row (needed for ICS CANCEL) and bumps the sequence. */
export async function cancelEvent(ctx: StaffCtx, id: string, expectedVersion: number) {
  if (!can(ctx.role, "calendar.write")) throw forbidden();
  const r = await db.calendarEvent.updateMany({ where: { id, workspaceId: ctx.workspaceId, version: expectedVersion, status: "scheduled" }, data: { status: "cancelled", icsSequence: { increment: 1 }, version: { increment: 1 } } });
  if (r.count === 0) throw stale();
}

/** Visible: events I organise or attend. Team-wide availability is not claimed. */
export function listEvents(ctx: StaffCtx, from: Date, to: Date, scope: "mine" | "team") {
  return db.calendarEvent.findMany({
    where: { workspaceId: ctx.workspaceId, startsAt: { gte: from, lt: to }, ...(scope === "mine" ? { OR: [{ organiserId: ctx.staffId }, { attendees: { some: { staffId: ctx.staffId } } }] } : {}) },
    include: { attendees: true }, orderBy: { startsAt: "asc" },
  });
}

const pad = (n: number) => String(n).padStart(2, "0");
const ics = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** "Add to calendar" file. Stable UID + SEQUENCE; this is not an invitation delivery. */
export function toIcs(e: { icsUid: string; icsSequence: number; title: string; startsAt: Date; endsAt: Date; status: string; location: string | null; description: string | null; updatedAt: Date }, organiserEmail: string) {
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OneSimpleSite//Manage//EN", "CALSCALE:GREGORIAN", `METHOD:${e.status === "cancelled" ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT", `UID:${e.icsUid}`, `SEQUENCE:${e.icsSequence}`, `DTSTAMP:${ics(e.updatedAt)}`, `DTSTART:${ics(e.startsAt)}`, `DTEND:${ics(e.endsAt)}`,
    `SUMMARY:${esc(e.title)}`, ...(e.location ? [`LOCATION:${esc(e.location)}`] : []), ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
    `ORGANIZER:mailto:${organiserEmail}`, `STATUS:${e.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`, "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n") + "\r\n";
}
