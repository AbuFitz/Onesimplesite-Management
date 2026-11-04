import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { db } from "@/lib/db";
import { applyStripeEvent, markPaidManually } from "@/modules/billing/service";
import { clientReceipts, receiptFor, buildReceiptPdf, companyForReceipt } from "@/modules/billing/receipt";
import { drainOutbox } from "@/modules/outbox/drain";
import type { StaffCtx } from "@/modules/identity/session";
import type { ClientCtx } from "@/modules/portal/service";

async function world() {
  const tag = Math.random().toString(36).slice(2, 8).toUpperCase();
  const w = await db.workspace.create({ data: { name: `rc-${tag}`, legalName: "OneSimpleSite Ltd", registeredAddress: "1 Road\nWatford", companyNumber: "12345678" } });
  const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `s-${tag}@x.test`, displayName: "Abukar", role: "owner", status: "active" } });
  const staff: StaffCtx = { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role: "owner", name: "Abukar", email: m.email };
  const mk = async (n: string) => { const c = await db.customer.create({ data: { workspaceId: w.id, reference: `OSS-CU-${Math.random().toString(36).slice(2, 8)}`, displayName: n, billingAddress: "2 Quay Rd" } }); await db.contact.create({ data: { workspaceId: w.id, customerId: c.id, name: "Hana", email: `hana-${tag.toLowerCase()}-${n}@c.test`, isPrimary: true } }); return c; };
  const a = await mk("a"), b = await mk("b");
  const k = await db.contract.create({ data: { workspaceId: w.id, customerId: a.id, reference: `OSS-OF-2026-${tag}`, title: "Website", status: "completed", scopeSnapshot: "x" } });
  const one = await db.billingIntent.create({ data: { workspaceId: w.id, customerId: a.id, contractId: k.id, kind: "one_off", amountMinor: 120000 } });
  const plan = await db.billingIntent.create({ data: { workspaceId: w.id, customerId: a.id, contractId: k.id, kind: "recurring_setup", amountMinor: 4900 } });
  const client = (c: { id: string }, billing = true): ClientCtx => ({ userId: `u-${c.id}`, name: "Hana", email: "h@x.test", memberships: [{ customerId: c.id, role: billing ? "admin" : "viewer", billing, customer: { id: c.id, displayName: "x", workspaceId: w.id } }] });
  return { w, staff, a, b, k, one, plan, ca: client(a), cb: client(b), tag };
}
const sink = () => readdirSync(".mail-sink").filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(`.mail-sink/${f}`, "utf8")) as { to: string; subject: string; text: string; attachments?: { filename: string; bytes: number }[] });

describe("receipts", () => {
  it("a card payment makes exactly one numbered receipt, emailed with the PDF attached, and shown in the portal", async () => {
    const x = await world();
    const ev = { id: "cs_1", metadata: { intentId: x.one.id }, payment_status: "paid", payment_intent: "pi_abcdef123456", customer_details: { email: `payer-${x.tag}@c.test`, name: "Pat" } };
    await applyStripeEvent("checkout.session.completed", ev, x.w.id); await applyStripeEvent("checkout.session.completed", ev, x.w.id);
    const rs = await clientReceipts(x.ca);
    expect(rs).toHaveLength(1); expect(rs[0]).toMatchObject({ amountMinor: 120000, method: "card", stripeRef: "pi_abcdef123456" }); expect(rs[0].ref).toMatch(/^OSS-RC-\d{4}-\d{4}$/); expect(rs[0].description).toContain("Website");
    await drainOutbox(300);
    const mail = sink().filter((m) => m.to === `payer-${x.tag}@c.test`);
    expect(mail).toHaveLength(1); expect(mail[0].text).toContain(rs[0].ref); expect(mail[0].attachments?.[0].filename).toBe(`${rs[0].ref}.pdf`); expect(mail[0].attachments?.[0].bytes).toBeGreaterThan(1500);
  });
  it("bank payments and later monthly payments get receipts too, without extra emails", async () => {
    const x = await world();
    await markPaidManually(x.staff, x.one.id, "bank");
    await applyStripeEvent("checkout.session.completed", { id: "cs_p", metadata: { intentId: x.plan.id }, payment_status: "paid", subscription: `sub_${x.tag}`, payment_intent: "pi_first" }, x.w.id);
    await applyStripeEvent("invoice.paid", { id: "in_first", subscription: `sub_${x.tag}`, billing_reason: "subscription_create", amount_paid: 4900 }, x.w.id);       // the first invoice is the checkout payment: no second receipt
    await applyStripeEvent("invoice.paid", { id: "in_feb", subscription: `sub_${x.tag}`, billing_reason: "subscription_cycle", amount_paid: 4900 }, x.w.id);
    await applyStripeEvent("invoice.paid", { id: "in_feb", subscription: `sub_${x.tag}`, billing_reason: "subscription_cycle", amount_paid: 4900 }, x.w.id);       // repeat
    const rs = await clientReceipts(x.ca);
    expect(rs.map((r) => r.method).sort()).toEqual(["bank", "card", "card"]);
    expect(new Set(rs.map((r) => r.ref)).size).toBe(3);
    const before = (await db.outbox.count({ where: { workspaceId: x.w.id, topic: "email.payment_received" } }));
    expect(before).toBe(1);                                                       // only the website payment emails; renewals are in the portal only
  });
  it("payments made before receipts existed get one the first time the customer looks, once", async () => {
    const x = await world();
    await db.billingIntent.update({ where: { id: x.one.id }, data: { status: "paid", paidAt: new Date("2026-10-01"), paidVia: "stripe" } });
    expect(await clientReceipts(x.ca)).toHaveLength(1); expect(await clientReceipts(x.ca)).toHaveLength(1);
  });
  it("only people with billing access to that business can open it, and the PDF is real", async () => {
    const x = await world();
    await markPaidManually(x.staff, x.one.id, "bank");
    const [r] = await clientReceipts(x.ca);
    expect((await receiptFor({ id: r.id, client: x.ca })).id).toBe(r.id);
    await expect(receiptFor({ id: r.id, client: x.cb })).rejects.toMatchObject({ code: "not_found" });
    await expect(receiptFor({ id: r.id, client: { ...x.ca, memberships: [{ ...x.ca.memberships[0], role: "viewer", billing: false }] } })).rejects.toMatchObject({ code: "not_found" });
    expect(await clientReceipts({ ...x.ca, memberships: [{ ...x.ca.memberships[0], role: "viewer", billing: false }] })).toEqual([]);
    const pdf = await buildReceiptPdf(r, { business: "Harbour Bakery", billingAddress: "2 Quay Rd" }, await companyForReceipt(x.w.id));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-"); expect(pdf.length).toBeGreaterThan(1500);
  });
});
