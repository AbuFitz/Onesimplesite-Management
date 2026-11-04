import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db, type Tx } from "@/lib/db";
import { nextRef } from "@/lib/audit";
import { notFound } from "@/lib/errors";
import { customersWhere } from "@/modules/portal/access";
import type { ClientCtx } from "@/modules/portal/service";

type Intent = { id: string; workspaceId: string; customerId: string; kind: string; amountMinor: number; currency: string; description: string | null; contractId: string | null; ticketId?: string | null };
const LABEL: Record<string, string> = { one_off: "Website", deposit: "Website deposit", balance: "Website final payment", recurring_setup: "Monthly plan", change: "Change request" };

/** Records that a payment was received. Safe to call twice for the same payment: `key` says which payment this is. Returns the receipt either way. */
export async function ensureReceipt(tx: Tx, b: Intent, o: { key: string; method: "card" | "bank" | "other"; paidAt?: Date; stripeRef?: string | null; amountMinor?: number }) {
  const found = await tx.receipt.findUnique({ where: { intentId_key: { intentId: b.id, key: o.key } } });
  if (found) return found;
  const title = b.contractId ? (await tx.contract.findUnique({ where: { id: b.contractId }, select: { title: true } }))?.title : b.ticketId ? (await tx.ticket.findUnique({ where: { id: b.ticketId }, select: { title: true } }))?.title : null;
  const what = b.description ?? LABEL[b.kind] ?? "Payment";
  return tx.receipt.create({ data: { workspaceId: b.workspaceId, customerId: b.customerId, intentId: b.id, ref: await nextRef(tx, b.workspaceId, "receipt"), key: o.key, description: title && title !== what ? `${what}: ${title}` : what, amountMinor: o.amountMinor ?? b.amountMinor, currency: b.currency, method: o.method, paidAt: o.paidAt ?? new Date(), stripeRef: o.stripeRef ?? null } });
}

/** A customer's receipts. Payments made before receipts existed are given one the first time they look. */
export async function clientReceipts(c: ClientCtx) {
  const ids = customersWhere(c, "billing");
  if (!ids.length) return [];
  const paid = await db.billingIntent.findMany({ where: { customerId: { in: ids }, status: { in: ["paid", "active"] }, paidAt: { not: null } }, take: 100 });
  const have = new Set((await db.receipt.findMany({ where: { intentId: { in: paid.map((p) => p.id) } }, select: { intentId: true } })).map((r) => r.intentId));
  for (const b of paid.filter((p) => !have.has(p.id))) await db.$transaction((tx) => ensureReceipt(tx, b, { key: "first", method: b.paidVia === "stripe" ? "card" : "bank", paidAt: b.paidAt ?? new Date() }));
  return db.receipt.findMany({ where: { customerId: { in: ids } }, orderBy: { paidAt: "desc" }, take: 100 });
}

export async function receiptFor(opts: { id: string; workspaceId?: string; client?: ClientCtx }) {
  const r = await db.receipt.findFirst({ where: { id: opts.id, ...(opts.workspaceId ? { workspaceId: opts.workspaceId } : {}), ...(opts.client ? { customerId: { in: customersWhere(opts.client, "billing") } } : {}) } });
  if (!r) throw notFound();
  return r;
}

const money = (minor: number, cur = "GBP") => new Intl.NumberFormat("en-GB", { style: "currency", currency: cur }).format(minor / 100);
const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(d);
const ascii = (t: string) => t.replace(/[^\x20-\x7e£]/g, "?").replace(/£/g, "GBP ");

/** A one-page receipt PDF. Plain and printable: who paid, what for, how much, when, and who to ask. */
export async function buildReceiptPdf(r: { ref: string; description: string; amountMinor: number; currency: string; method: string; paidAt: Date; stripeRef: string | null }, party: { business: string; billingAddress: string | null }, us: { legalName: string; address: string | null; companyNumber: string | null; email: string }) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Receipt ${r.ref}`); pdf.setProducer("OneSimpleSite");
  const page = pdf.addPage([595.28, 841.89]);
  const reg = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const INK = rgb(0.055, 0.075, 0.067), GREY = rgb(0.35, 0.38, 0.36), GREEN = rgb(0.047, 0.416, 0.286), LINE = rgb(0.85, 0.87, 0.86);
  const M = 56, W = 595.28 - M * 2;
  page.drawRectangle({ x: 0, y: 841.89 - 12, width: 595.28, height: 12, color: GREEN });
  page.drawText("OneSimpleSite", { x: M, y: 770, size: 20, font: bold, color: INK });
  page.drawText("RECEIPT", { x: 595.28 - M - bold.widthOfTextAtSize("RECEIPT", 26), y: 768, size: 26, font: bold, color: GREEN });
  let y = 720;
  const row = (label: string, value: string, strong = false) => { page.drawText(ascii(label), { x: M, y, size: 10, font: reg, color: GREY }); page.drawText(ascii(value), { x: M + 150, y, size: strong ? 12 : 11, font: strong ? bold : reg, color: INK, maxWidth: W - 150 }); y -= strong ? 26 : 22; };
  row("Receipt number", r.ref, true); row("Date paid", day(r.paidAt)); row("Received from", party.business);
  if (party.billingAddress) row("Address", party.billingAddress.replace(/\s*\n\s*/g, ", "));
  row("Payment method", r.method === "card" ? "Card" : r.method === "bank" ? "Bank transfer" : "Other");
  if (r.stripeRef) row("Payment reference", r.stripeRef.slice(-12));
  y -= 10; page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.8, color: LINE }); y -= 28;
  page.drawText("For", { x: M, y, size: 10, font: reg, color: GREY }); page.drawText("Amount", { x: M + W - reg.widthOfTextAtSize("Amount", 10), y, size: 10, font: reg, color: GREY }); y -= 22;
  page.drawText(ascii(r.description), { x: M, y, size: 12, font: reg, color: INK, maxWidth: W - 120 });
  const amt = money(r.amountMinor, r.currency).replace("£", "GBP "); page.drawText(amt, { x: M + W - bold.widthOfTextAtSize(amt, 12), y, size: 12, font: bold, color: INK }); y -= 30;
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.8, color: LINE }); y -= 30;
  page.drawText("Total paid", { x: M, y, size: 13, font: bold, color: INK }); page.drawText(amt, { x: M + W - bold.widthOfTextAtSize(amt, 16), y: y - 2, size: 16, font: bold, color: GREEN }); y -= 60;
  page.drawText("Thank you. This receipt confirms we have received this payment in full.", { x: M, y, size: 10, font: reg, color: GREY }); y -= 16;
  page.drawText("We are not VAT registered, so no VAT is shown.", { x: M, y, size: 10, font: reg, color: GREY });
  const foot = [us.legalName + (us.companyNumber ? `  |  Company no. ${us.companyNumber}` : ""), us.address ?? "", us.email].filter(Boolean).map(ascii);
  foot.forEach((t, i) => page.drawText(t, { x: M, y: 70 - i * 13, size: 9, font: reg, color: GREY, maxWidth: W }));
  return Buffer.from(await pdf.save());
}

export async function companyForReceipt(workspaceId: string) {
  const w = await db.workspace.findUnique({ where: { id: workspaceId }, select: { legalName: true, registeredAddress: true, companyNumber: true } });
  return { legalName: w?.legalName ?? "OneSimpleSite", address: w?.registeredAddress?.replace(/\s*\n\s*/g, ", ") ?? null, companyNumber: w?.companyNumber ?? null, email: "hello@onesimplesite.co.uk" };
}
