import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { createEvent, updateEvent } from "@/modules/calendar/service";
import type { StaffCtx } from "@/modules/identity/session";

describe("moving an event", () => {
  it("changes time and title, bumps the ICS sequence, and rejects a stale edit", async () => {
    const tag = Math.random().toString(36).slice(2, 8);
    const w = await db.workspace.create({ data: { name: `ev-${tag}` } });
    const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `s-${tag}@x.test`, displayName: "A", role: "owner", status: "active" } });
    const ctx: StaffCtx = { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role: "owner", name: "A", email: m.email };
    const ev = await createEvent(ctx, { title: "Call", startsAt: new Date("2026-12-01T10:00:00Z"), endsAt: new Date("2026-12-01T11:00:00Z") });
    await updateEvent(ctx, ev.id, ev.version, { title: "Call moved", type: "client_call", startsAt: new Date("2026-12-02T14:00:00Z"), endsAt: new Date("2026-12-02T14:30:00Z") });
    const after = await db.calendarEvent.findUniqueOrThrow({ where: { id: ev.id } });
    expect(after.title).toBe("Call moved"); expect(after.icsSequence).toBe(ev.icsSequence + 1); expect(after.startsAt.toISOString()).toBe("2026-12-02T14:00:00.000Z");
    await expect(updateEvent(ctx, ev.id, ev.version, { title: "x", startsAt: new Date("2026-12-03T10:00:00Z"), endsAt: new Date("2026-12-03T11:00:00Z") })).rejects.toThrow();
  });
});
