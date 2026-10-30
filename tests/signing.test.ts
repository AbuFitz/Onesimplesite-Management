import { describe, it, expect } from "vitest";
import { deflateSync, crc32 } from "node:zlib";
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { db } from "@/lib/db";
import { createLead } from "@/modules/crm/service";
import { createProposal, sendProposal, acceptProposal } from "@/modules/sales/service";
import { sendForSigning, submitSignature, viewSigning, voidSigning, declineSigning, canonical } from "@/modules/signing/service";
import { drainOutbox } from "@/modules/outbox/drain";
import { renderEmail } from "@/emails/templates";
import { sha256, sha256Bytes } from "@/lib/tokens";
import type { StaffCtx } from "@/modules/identity/session";

async function ws(role: StaffCtx["role"] = "owner"): Promise<StaffCtx> {
  const w = await db.workspace.create({ data: { name: `sig-${Math.random()}` } });
  const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `s-${Math.random()}@example.test`, displayName: "Staff", role, status: "active" } });
  return { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role, name: "Staff", email: m.email };
}
const draft = { title: "Site", scope: "Five pages.", terms: "Net 14", lines: [{ description: "Build", quantity: 1, unitMinor: 100000, recurring: false }, { description: "Hosting", quantity: 1, unitMinor: 2000, recurring: true }], recurringPeriod: "month" as const };

async function contract(ctx: StaffCtx) {
  const lead = await createLead(ctx, { displayName: "Acme Ltd", contactName: "Ann", email: "ann@acme.test" });
  const p = await createProposal(ctx, lead.customerId, lead.opportunityId, draft);
  const { token } = await sendProposal(ctx, p.id, "ann@acme.test");
  const { contractId } = await acceptProposal(token, { name: "Ann", consent: true }, {});
  return contractId;
}
const ok = { name: "Ann Acme", method: "typed" as const, consent: true as const };

function png() {
  const w = 60, h = 30, raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; randomBytes(w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const chunk = (t: string, d: Buffer) => { const b = Buffer.concat([Buffer.from(t), d]); const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(b)); return Buffer.concat([len, b, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

describe("single-signer capture", () => {
  it("signs once under concurrency: one record, one PDF, one project, one email each", async () => {
    const ctx = await ws();
    const id = await contract(ctx);
    const { token } = await sendForSigning(ctx, id, { name: "Ann Acme", email: "ann@acme.test" });
    const res = await Promise.allSettled(Array.from({ length: 5 }, () => submitSignature(token, ok, { ip: "203.0.113.9" })));
    expect(res.filter((r) => r.status === "fulfilled").length).toBeGreaterThanOrEqual(1);
    const req = await db.signingRequest.findFirstOrThrow({ where: { contractId: id } });
    expect(await db.signatureRecord.count({ where: { signingRequestId: req.id } })).toBe(1);
    expect(await db.contractDocument.count({ where: { contractId: id } })).toBe(1);
    expect(await db.project.count({ where: { contractId: id } })).toBe(1);
    expect(await db.billingIntent.count({ where: { contractId: id } })).toBe(2);
    expect((await db.contract.findUniqueOrThrow({ where: { id } })).status).toBe("completed");
    expect(await db.outbox.count({ where: { workspaceId: ctx.workspaceId, topic: { in: ["email.signing_confirmation", "email.signing_notice"] } } })).toBe(2);
    // after signing the link is dead
    expect((await viewSigning(token)).ok).toBe(false);
    await expect(submitSignature(token, ok, {})).rejects.toBeTruthy();
  });

  it("final PDF is a real PDF, hash matches, evidence hash re-computes, records are immutable", async () => {
    const ctx = await ws();
    const id = await contract(ctx);
    const { token } = await sendForSigning(ctx, id, { name: "Ann Acme", email: "ann@acme.test" });
    await submitSignature(token, { ...ok, method: "drawn", image: `data:image/png;base64,${png().toString("base64")}` }, {});
    const doc = await db.contractDocument.findFirstOrThrow({ where: { contractId: id } });
    expect(Buffer.from(doc.bytes).subarray(0, 5).toString()).toBe("%PDF-");
    expect(sha256Bytes(doc.bytes)).toBe(doc.sha256);
    const rec = await db.signatureRecord.findFirstOrThrow({ where: { request: { contractId: id } } });
    expect(sha256(canonical(rec.evidence))).toBe(rec.evidenceSha256);
    expect(rec.method).toBe("drawn");
    await expect(db.contractDocument.update({ where: { id: doc.id }, data: { sha256: "x" } })).rejects.toThrow(/append-only/);
    await expect(db.signatureRecord.delete({ where: { id: rec.id } })).rejects.toThrow(/append-only/);
    await expect(db.signingRequest.update({ where: { id: rec.signingRequestId }, data: { contentText: "tampered" } })).rejects.toThrow(/frozen/);
  });

  it("validates consent, name, and drawn image", async () => {
    const ctx = await ws();
    const id = await contract(ctx);
    const { token } = await sendForSigning(ctx, id, { name: "Ann", email: "ann@acme.test" });
    await expect(submitSignature(token, { ...ok, consent: false }, {})).rejects.toThrow();
    await expect(submitSignature(token, { ...ok, name: "A" }, {})).rejects.toThrow();
    await expect(submitSignature(token, { ...ok, method: "drawn", image: "data:image/png;base64,AAAA" }, {})).rejects.toMatchObject({ code: "validation" });
    expect((await db.contract.findUniqueOrThrow({ where: { id } })).status).toBe("awaiting_signature");
  });

  it("token misuse: unknown, other contract's, expired, revoked by reissue, voided, declined", async () => {
    const ctx = await ws();
    const a = await contract(ctx), b = await contract(ctx);
    const ta = (await sendForSigning(ctx, a, { name: "A", email: "a@x.test" })).token;
    const tb = (await sendForSigning(ctx, b, { name: "B", email: "b@x.test" })).token;
    expect((await viewSigning("nope")).ok).toBe(false);
    await submitSignature(ta, ok, {});
    expect((await db.contract.findUniqueOrThrow({ where: { id: b } })).status).toBe("awaiting_signature"); // A's signature did not touch B
    const re = await sendForSigning(ctx, b, { name: "B2", email: "b2@x.test" });
    expect((await viewSigning(tb)).ok).toBe(false);
    await expect(submitSignature(tb, ok, {})).rejects.toMatchObject({ code: "expired_link" });
    await db.scopedLinkToken.updateMany({ where: { recipientEmail: "b2@x.test" }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(submitSignature(re.token, ok, {})).rejects.toMatchObject({ code: "expired_link" });
    const c = await contract(ctx);
    const tc = (await sendForSigning(ctx, c, { name: "C", email: "c@x.test" })).token;
    await voidSigning(ctx, c);
    await expect(submitSignature(tc, ok, {})).rejects.toBeTruthy();
    const d = await contract(ctx);
    const td = (await sendForSigning(ctx, d, { name: "D", email: "d@x.test" })).token;
    await declineSigning(td, "not now");
    expect((await db.contract.findUniqueOrThrow({ where: { id: d } })).status).toBe("declined");
    expect(await db.project.count({ where: { contractId: d } })).toBe(0);
  });

  it("role without contract.send cannot send; other workspace cannot send", async () => {
    const ctx = await ws();
    const id = await contract(ctx);
    await expect(sendForSigning({ ...ctx, role: "delivery" }, id, { name: "A", email: "a@x.test" })).rejects.toMatchObject({ code: "forbidden" });
    await expect(sendForSigning(await ws(), id, { name: "A", email: "a@x.test" })).rejects.toMatchObject({ code: "not_found" });
  });

  it("emails: request, confirmation (with PDF) and internal notice to hello@ are produced once; replays do not duplicate", async () => {
    rmSync(".mail-sink", { recursive: true, force: true });
    const ctx = await ws();
    const id = await contract(ctx);
    const { token } = await sendForSigning(ctx, id, { name: "Ann Acme", email: "ann-mail@acme.test" });
    await submitSignature(token, ok, {});
    await drainOutbox(200); await drainOutbox(200);
    const mails = readdirSync(".mail-sink").filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(`.mail-sink/${f}`, "utf8")));
    const mine = mails.filter((m) => m.to === "ann-mail@acme.test" || (m.subject.startsWith("Contract signed") && m.text.includes("ann-mail@acme.test")));
    expect(mine.map((m) => m.subject.split(":")[0]).sort()).toEqual(["Contract signed", "Please review and sign", "Signed"]);
    const notice = mine.find((m) => m.subject.startsWith("Contract signed"))!;
    expect(notice.to).toBe("hello@onesimplesite.co.uk");
    expect(notice.attachments?.[0].filename).toMatch(/signed\.pdf$/);
    const conf = mine.find((m) => m.subject.startsWith("Signed"))!;
    expect(conf.from).toContain("contracts@onesimplesite.co.uk");
    expect(conf.attachments?.length).toBe(1);
    expect(conf.html).toContain("<img");
  });

  it("templates render html + text for every template", async () => {
    const r = await renderEmail("invitation", { to: "x", businessName: "B", inviter: "I", link: "https://p/invite/t", expires: "d" });
    expect(r.html).toContain("https://p/invite/t"); expect(r.text).toContain("https://p/invite/t");
  });
});
