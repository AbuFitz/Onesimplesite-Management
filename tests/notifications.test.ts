import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { enqueue } from "@/lib/audit";
import { resolveDelivery, NOTIFY_EVENTS } from "@/modules/settings/notifications";
import { saveNotifyPrefs } from "@/modules/settings/plans";
import { sendDailyDigest } from "@/modules/outbox/digest";
import { drainOutbox } from "@/modules/outbox/drain";
import { readdirSync, readFileSync } from "node:fs";
import type { StaffCtx } from "@/modules/identity/session";

async function world() {
  const w = await db.workspace.create({ data: { name: `nf-${Math.random()}` } });
  const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `s-${Math.random()}@example.test`, displayName: "Abukar", role: "owner", status: "active" } });
  const staff: StaffCtx = { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role: "owner", name: "Abukar", email: m.email };
  return { w, staff };
}
const q = (w: string, topic: string, key: string, payload: object) => db.$transaction((tx) => enqueue(tx, w, topic, key, payload));
const sink = () => readdirSync(".mail-sink").filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(`.mail-sink/${f}`, "utf8")) as { subject: string; text: string; to: string });

describe("choosing which emails are sent", () => {
  it("defaults are quiet: team notices bundle up, optional customer emails are off, required ones always send", () => {
    expect(resolveDelivery({}, "email.ticket_notice", { priority: "normal" })).toBe("digest");
    expect(resolveDelivery({}, "email.ticket_notice", { priority: "urgent" })).toBe("instant");
    expect(resolveDelivery({}, "email.payment_notice", { event: "paid" })).toBe("digest");
    expect(resolveDelivery({}, "email.payment_notice", { event: "failed" })).toBe("instant");
    expect(resolveDelivery({}, "email.signing_notice", {})).toBe("instant");
    expect(resolveDelivery({}, "email.ticket_received", {})).toBe("off");
    for (const required of ["email.payment_received", "email.invitation", "email.contract_request", "email.signing_confirmation", "email.ticket_reply", "email.change_request_quote", "email.password_reset", "email.payment_failed"]) expect(resolveDelivery({}, required, {})).toBeNull();
  });
  it("a choice is honoured, an invalid one is ignored, and 'off' beats the urgent exception", () => {
    expect(resolveDelivery({ "email.ticket_notice": "instant" }, "email.ticket_notice", { priority: "low" })).toBe("instant");
    expect(resolveDelivery({ "email.ticket_received": "digest" }, "email.ticket_received", {})).toBe("off");   // not a mode this email supports
    expect(resolveDelivery({ "email.ticket_notice": "off" }, "email.ticket_notice", { priority: "urgent" })).toBe("off");
    expect(NOTIFY_EVENTS.every((e) => e.modes.includes(e.default))).toBe(true);
  });

  it("queueing respects the setting: off queues nothing, summary holds it, instant sends it; required emails are untouched", async () => {
    const x = await world();
    await q(x.w.id, "email.ticket_received", "a", { to: "c@x.test" });                           // off by default
    await q(x.w.id, "email.ticket_notice", "b", { to: "internal", priority: "normal" });          // held
    await q(x.w.id, "email.ticket_notice", "c", { to: "internal", priority: "urgent" });          // instant
    await q(x.w.id, "email.payment_received", "d", { to: "c@x.test" });                           // required
    const rows = Object.fromEntries((await db.outbox.findMany({ where: { workspaceId: x.w.id } })).map((r) => [r.dedupeKey, r.status]));
    expect(rows).toEqual({ b: "held", c: "pending", d: "pending" });
    await saveNotifyPrefs(x.staff, { "email.ticket_received": "instant", "email.ticket_notice": "off", "email.bogus": "instant", "email.signing_notice": "nonsense" });
    await q(x.w.id, "email.ticket_received", "a2", { to: "c@x.test" }); await q(x.w.id, "email.ticket_notice", "b2", { to: "internal", priority: "normal" });
    const after = await db.outbox.findMany({ where: { workspaceId: x.w.id, dedupeKey: { in: ["a2", "b2"] } } });
    expect(after.map((r) => r.dedupeKey)).toEqual(["a2"]);
    expect(((await db.workspace.findUniqueOrThrow({ where: { id: x.w.id } })).settings as { notify: object }).notify).toEqual({ "email.ticket_received": "instant", "email.ticket_notice": "off" });
  });

  it("the daily summary bundles everything held into one email, once, and held rows are never sent on their own", async () => {
    const x = await world();
    const U = Math.random().toString(36).slice(2, 8), FORM = `Form broken ${U}`;   // unique, so other runs' mail in the shared sink can't interfere
    await q(x.w.id, "email.ticket_notice", "t1", { to: "internal", business: "Harbour Bakery", person: "Hana", title: FORM, ref: "OSS-TK-1", priority: "high", link: "https://m/x", isReply: false });
    await q(x.w.id, "email.payment_notice", "p1", { to: "internal", event: "paid", business: "Harbour Bakery", what: "Website", amount: "£1,200.00", link: "https://m/y" });
    await q(x.w.id, "email.access_request_notice", "a1", { to: "internal", business: "Quay", requester: "Sam", name: "Kim", link: "https://m/z" });
    await drainOutbox(300);
    expect(sink().some((m) => m.text.includes(FORM))).toBe(false);                      // nothing sent individually
    expect(await sendDailyDigest(x.w.id, { now: new Date("2026-11-04T05:00:00Z") })).toMatchObject({ sent: 0, reason: "too early" });   // 05:00 London
    expect(await sendDailyDigest(x.w.id, { now: new Date("2026-11-04T09:00:00Z") })).toMatchObject({ sent: 1, items: 3 });
    expect(await sendDailyDigest(x.w.id, { now: new Date("2026-11-04T09:30:00Z") })).toMatchObject({ sent: 0 });
    await drainOutbox(300);
    const d = sink().filter((m) => m.subject.startsWith("Your daily summary: 3") && m.text.includes(FORM));
    expect(d).toHaveLength(1); for (const need of [FORM, "Payment received: Harbour Bakery", "asked to add Kim", "https://m/x"]) expect(d[0].text).toContain(need);
    expect(await db.outbox.count({ where: { workspaceId: x.w.id, status: "held" } })).toBe(0);
  });
});
