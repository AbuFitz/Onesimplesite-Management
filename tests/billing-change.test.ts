import { describe, it, expect, vi } from "vitest";
import { db } from "@/lib/db";
import { startPayment } from "@/modules/billing/service";
import type { ClientCtx } from "@/modules/portal/service";

describe("paying a change request", () => {
  it("builds a one-off checkout for a charge that belongs to a ticket (no agreement)", async () => {
    const w = await db.workspace.create({ data: { name: `chg-${Math.random()}` } });
    const c = await db.customer.create({ data: { workspaceId: w.id, reference: `OSS-CU-${Math.random().toString(36).slice(2, 8)}`, displayName: "Harbour Bakery" } });
    const t = await db.ticket.create({ data: { workspaceId: w.id, customerId: c.id, reference: `OSS-TK-${Math.random().toString(36).slice(2, 8)}`, title: "Add booking page", body: "x", priority: "normal", status: "open" } });
    const b = await db.billingIntent.create({ data: { workspaceId: w.id, customerId: c.id, ticketId: t.id, kind: "change", amountMinor: 5000, description: "Add booking page" } });
    const client: ClientCtx = { userId: "u", name: "Hana", email: "hana@client.test", memberships: [{ customerId: c.id, role: "admin", customer: { id: c.id, displayName: c.displayName, workspaceId: w.id } }] };
    const calls: { url: string; body: URLSearchParams }[] = [];
    const key = process.env.STRIPE_SECRET_KEY; process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (u, init) => { const url = String(u); calls.push({ url, body: new URLSearchParams(String((init as RequestInit).body ?? "")) }); return new Response(JSON.stringify(url.endsWith("/customers") ? { id: "cus_1" } : { id: "cs_1", url: "https://checkout.stripe.test/pay/cs_1" }), { status: 200 }); });
    try {
      expect(await startPayment(client, b.id)).toBe("https://checkout.stripe.test/pay/cs_1");
      const s = calls.find((x) => x.url.endsWith("/checkout/sessions"))!.body;
      expect(s.get("mode")).toBe("payment"); expect(s.get("line_items[0][price_data][unit_amount]")).toBe("5000");
    } finally { spy.mockRestore(); if (key === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = key; }
  });

  it("replaces a Stripe customer that no longer exists (test vs live keys) instead of failing, and says something useful on other errors", async () => {
    const w = await db.workspace.create({ data: { name: `chg2-${Math.random()}` } });
    const c = await db.customer.create({ data: { workspaceId: w.id, reference: `OSS-CU-${Math.random().toString(36).slice(2, 8)}`, displayName: "Old Test Co", stripeCustomerId: "cus_from_test_mode" } });
    const t = await db.ticket.create({ data: { workspaceId: w.id, customerId: c.id, reference: `OSS-TK-${Math.random().toString(36).slice(2, 8)}`, title: "Change", body: "x", priority: "normal", status: "open" } });
    const b = await db.billingIntent.create({ data: { workspaceId: w.id, customerId: c.id, ticketId: t.id, kind: "change", amountMinor: 5000 } });
    const client: ClientCtx = { userId: "u", name: "Hana", email: "hana@client.test", memberships: [{ customerId: c.id, role: "admin", customer: { id: c.id, displayName: c.displayName, workspaceId: w.id } }] };
    const key = process.env.STRIPE_SECRET_KEY; process.env.STRIPE_SECRET_KEY = "sk_live_dummy";
    let mode: "stale" | "boom" = "stale";
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (u, init) => {
      const url = String(u), body = String((init as RequestInit).body ?? "");
      if (url.endsWith("/customers")) return new Response(JSON.stringify({ id: "cus_live_1" }), { status: 200 });
      if (mode === "boom") return new Response(JSON.stringify({ error: { message: "Your account cannot currently make live charges." } }), { status: 400 });
      if (body.includes("cus_from_test_mode")) return new Response(JSON.stringify({ error: { message: "No such customer: 'cus_from_test_mode'" } }), { status: 400 });
      return new Response(JSON.stringify({ id: "cs_live", url: "https://checkout.stripe.test/pay/cs_live" }), { status: 200 });
    });
    try {
      expect(await startPayment(client, b.id)).toBe("https://checkout.stripe.test/pay/cs_live");
      expect((await db.customer.findUniqueOrThrow({ where: { id: c.id } })).stripeCustomerId).toBe("cus_live_1");
      mode = "boom";
      await expect(startPayment(client, b.id)).rejects.toMatchObject({ message: expect.stringMatching(/couldn't start the payment/i) });
      const pr = await db.auditEvent.findFirst({ where: { workspaceId: w.id, action: "problem.payment_start" } });
      expect((pr?.detail as { message: string }).message).toMatch(/live charges/);   // the team sees the real reason
    } finally { spy.mockRestore(); if (key === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = key; }
  });
});
