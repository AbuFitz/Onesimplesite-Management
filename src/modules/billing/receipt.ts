import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { A4, hex, safe, wrap, wordmark } from "@/modules/signing/pdf";
import { WORDMARK_REVERSED } from "@/documents/wordmark";
import { MAST_PNG, WISPS_JPG } from "@/documents/art";
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

/**
 * The receipt, in the same document design as the agreement: the dark masthead with the wordmark, the title with its last word in spring green,
 * the mono reference row, bone "from / to" panels, hairline rules, the moss tab and the same footer. A receipt should look like it came from the same hand as the agreement.
 */
export async function buildReceiptPdf(r: { ref: string; description: string; amountMinor: number; currency: string; method: string; paidAt: Date; stripeRef: string | null }, party: { business: string; billingAddress: string | null }, us: { legalName: string; address: string | null; companyNumber: string | null; email: string }) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Receipt ${r.ref}`); pdf.setProducer("OneSimpleSite Manage"); pdf.setCreator("OneSimpleSite Manage");
  const reg = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold), mono = await pdf.embedFont(StandardFonts.Courier), monoB = await pdf.embedFont(StandardFonts.CourierBold);
  const [mastImg, wispA] = [await pdf.embedPng(Buffer.from(MAST_PNG, "base64")), await pdf.embedJpg(Buffer.from(WISPS_JPG, "base64"))];
  const page = pdf.addPage(A4);
  const H = A4[1], M = 51, W = A4[0] - M * 2;
  const INK = rgb(0.055, 0.075, 0.067), MOSS = rgb(0.047, 0.416, 0.286), GREY = rgb(0.36, 0.38, 0.37), BONE = rgb(0.937, 0.922, 0.89), HAIR = rgb(0.86, 0.865, 0.86);
  const SPRING = hex("#4fd9a0"), BONE_T = rgb(0.937, 0.922, 0.89);
  const up = (t: string) => safe(t).toUpperCase();
  const rtext = (t: string, xRight: number, yy: number, size: number, font: PDFFont, color = INK) => page.drawText(t, { x: xRight - font.widthOfTextAtSize(t, size), y: yy, size, font, color });
  const roundRect = (x: number, yTop: number, w: number, h: number, rad: number, color: ReturnType<typeof rgb>, opacity = 1) =>
    page.drawSvgPath(`M ${rad} 0 H ${w - rad} Q ${w} 0 ${w} ${rad} V ${h - rad} Q ${w} ${h} ${w - rad} ${h} H ${rad} Q 0 ${h} 0 ${h - rad} V ${rad} Q 0 0 ${rad} 0 Z`, { x, y: yTop, color, opacity, borderWidth: 0 });

  // Masthead: the artwork, the wordmark, "RECEIPT" with its last word in green, then the mono reference row.
  page.drawImage(wispA, { x: 0, y: 0, width: A4[0], height: H });
  const mh = 112 * 2.835; page.drawImage(mastImg, { x: 0, y: H - mh, width: A4[0], height: mh });
  wordmark(page, WORDMARK_REVERSED, M, H - 28, 172);
  rtext(up(`Paid by ${party.business}`), A4[0] - M, H - 47, 6.8, mono, BONE_T);
  page.drawText("PAYMENT ", { x: M, y: H - 100, size: 29, font: bold, color: BONE_T });
  page.drawText("RECEIPT", { x: M + bold.widthOfTextAtSize("PAYMENT", 29) + 11, y: H - 100, size: 29, font: bold, color: SPRING });
  let mx = M; const my = H - 118;
  for (const [k, v] of [["REF", r.ref], ["DATE", up(day(r.paidAt))], ["STATUS", "PAID IN FULL"]]) {
    page.drawText(`${k} `, { x: mx, y: my, size: 6.6, font: mono, color: rgb(0.62, 0.62, 0.6) }); mx += mono.widthOfTextAtSize(`${k} `, 6.6);
    page.drawText(v, { x: mx, y: my, size: 6.6, font: monoB, color: BONE_T }); mx += monoB.widthOfTextAtSize(v, 6.6) + 22;
  }

  // From and to, as the agreement's two panels.
  let y = H - 198;
  const gap = 14, colW = (W - gap) / 2;
  const fromLines = [us.legalName, us.companyNumber ? `Company no. ${us.companyNumber}` : "", us.address ?? "", us.email].filter(Boolean);
  const toLines = [party.business, party.billingAddress ? party.billingAddress.replace(/\s*\n\s*/g, ", ") : ""].filter(Boolean);
  const panel = (x: number, label: string, lines: string[], h: number) => {
    roundRect(x, y, colW, h, 6, BONE, 0.9);
    page.drawText(up(label), { x: x + 14, y: y - 20, size: 7, font: bold, color: MOSS });
    let ly = y - 20;
    lines.forEach((l, n) => { for (const w of wrap(safe(l), n === 0 ? bold : reg, n === 0 ? 10 : 9, colW - 28)) { ly -= n === 0 ? 16 : 13.2; page.drawText(w, { x: x + 14, y: ly, size: n === 0 ? 10 : 9, font: n === 0 ? bold : reg, color: INK }); } });
  };
  const hh = Math.max(...[fromLines, toLines].map((ls) => 38 + ls.reduce((n, l, i) => n + wrap(safe(l), i === 0 ? bold : reg, i === 0 ? 10 : 9, colW - 28).length * 13.2, 0) + 8));
  panel(M, "Received by", fromLines, hh); panel(M + colW + gap, "Received from", toLines, hh);
  y -= hh + 26;

  // What it was for: a numbered section header, a hairline, the line, then the total in its own panel.
  page.drawText("01", { x: M, y: y - 9, size: 7.6, font: mono, color: MOSS });
  page.drawText("WHAT THIS PAYMENT WAS FOR", { x: M + 34, y: y - 10, size: 11.5, font: bold, color: INK });
  y -= 21; page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.6, color: HAIR }); y -= 22;
  const amt = money(r.amountMinor, r.currency);
  for (const l of wrap(safe(r.description), reg, 11, W - 130)) { page.drawText(l, { x: M, y, size: 11, font: reg, color: INK }); y -= 16; }
  rtext(amt, M + W, y + 16, 11, bold);
  y -= 14; page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.6, color: HAIR }); y -= 18;
  roundRect(M, y, W, 64, 8, BONE, 0.9);
  page.drawText("TOTAL PAID", { x: M + 18, y: y - 26, size: 7, font: bold, color: MOSS });
  page.drawText("No VAT is shown: we are not VAT registered.", { x: M + 18, y: y - 44, size: 8.5, font: reg, color: GREY });
  rtext(amt, M + W - 18, y - 42, 26, bold, INK);
  y -= 64 + 28;

  // How it was paid.
  page.drawText("02", { x: M, y: y - 9, size: 7.6, font: mono, color: MOSS });
  page.drawText("HOW IT WAS PAID", { x: M + 34, y: y - 10, size: 11.5, font: bold, color: INK });
  y -= 21; page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.6, color: HAIR }); y -= 20;
  const kv = (k: string, v: string) => { page.drawText(up(k), { x: M, y, size: 6.8, font: mono, color: MOSS }); page.drawText(safe(v), { x: M + 150, y: y - 0.5, size: 10, font: reg, color: INK }); y -= 19; };
  kv("Method", r.method === "card" ? "Card" : r.method === "bank" ? "Bank transfer" : "Other");
  kv("Paid on", day(r.paidAt));
  if (r.stripeRef) kv("Payment reference", r.stripeRef.slice(-12));
  kv("Receipt number", r.ref);
  y -= 14;
  for (const l of wrap("Thank you. This receipt confirms we have received this payment in full. Keep it for your records. If anything looks wrong, reply to the email it came with or write to " + us.email + ".", reg, 9.5, W)) { page.drawText(l, { x: M, y, size: 9.5, font: reg, color: GREY }); y -= 14; }

  // The same footer as the agreement.
  page.drawLine({ start: { x: M, y: 44 }, end: { x: M + W, y: 44 }, thickness: 0.6, color: HAIR });
  page.drawRectangle({ x: M, y: 43, width: 62, height: 2.5, color: MOSS });
  page.drawText("ONESIMPLESITE.CO.UK", { x: M, y: 27, size: 6.4, font: mono, color: GREY });
  const mid = "PRIVATE & CONFIDENTIAL"; page.drawText(mid, { x: (A4[0] - mono.widthOfTextAtSize(mid, 6.4)) / 2, y: 27, size: 6.4, font: mono, color: GREY });
  rtext(`RECEIPT ${r.ref}`, A4[0] - M, 27, 6.4, mono, GREY);
  return Buffer.from(await pdf.save());
}

export async function companyForReceipt(workspaceId: string) {
  const w = await db.workspace.findUnique({ where: { id: workspaceId }, select: { legalName: true, registeredAddress: true, companyNumber: true } });
  return { legalName: w?.legalName ?? "OneSimpleSite", address: w?.registeredAddress?.replace(/\s*\n\s*/g, ", ") ?? null, companyNumber: w?.companyNumber ?? null, email: "hello@onesimplesite.co.uk" };
}
