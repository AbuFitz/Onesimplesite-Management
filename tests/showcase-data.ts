import "dotenv/config";
import { db } from "../src/lib/db";
import { createLead } from "../src/modules/crm/service";
import { createProposal, sendProposal, acceptProposal } from "../src/modules/sales/service";
import { sendForSigning, submitSignature } from "../src/modules/signing/service";
import { portalLink } from "../src/lib/env";
import { writeFileSync } from "node:fs";

// Synthetic showcase data only.
const w = await db.workspace.findFirstOrThrow({ where: { name: "OneSimpleSite" } });
const m = await db.staffMembership.findFirstOrThrow({ where: { workspaceId: w.id, status: "active", role: "owner" } });
const ctx = { userId: m.userId!, staffId: m.id, workspaceId: w.id, role: m.role, name: m.displayName, email: m.email };
const draft = {
  title: "Website build and care plan",
  scope: "Design and build of a five-page responsive website for Harbour Bakery.\n\nDeliverables\n- Home, Menu, About, Gallery and Contact pages\n- Contact form with email delivery\n- Basic on-page SEO and analytics set-up\n\nExclusions\n- Copywriting and photography\n- Third-party licences\n\nRevisions\nTwo rounds of revisions are included.",
  terms: "Payment terms and the deposit schedule are set out in the accompanying billing schedule. Hosting is billed monthly and may be cancelled with 30 days' notice.",
  lines: [{ description: "Website design and build", quantity: 1, unitMinor: 180000, recurring: false }, { description: "Hosting and maintenance", quantity: 1, unitMinor: 3500, recurring: true }],
  recurringPeriod: "month" as const, validUntil: new Date(Date.now() + 30 * 864e5),
};
const lead = await createLead(ctx, { displayName: "Harbour Bakery (showcase)", contactName: "Casey Morgan", email: "casey@harbour.example" });
const p = await createProposal(ctx, lead.customerId, lead.opportunityId, draft);
const sent = await sendProposal(ctx, p.id, "casey@harbour.example");
const open = await createProposal(ctx, lead.customerId, null, { ...draft, title: "Second proposal (showcase)" });
const sent2 = await sendProposal(ctx, open.id, "casey@harbour.example");
const acc = await acceptProposal(sent.token, { name: "Casey Morgan", consent: true }, {});
const s1 = await sendForSigning(ctx, acc.contractId, { name: "Casey Morgan", email: "casey@harbour.example" });

// second signed contract for the drawn-signature PDF sample
const acc2 = await acceptProposal(sent2.token, { name: "Casey Morgan", consent: true }, {});
const s2 = await sendForSigning(ctx, acc2.contractId, { name: "Casey Morgan", email: "casey@harbour.example" });
const { deflateSync, crc32 } = await import("node:zlib");
const W = 240, H = 90, raw = Buffer.alloc((W * 4 + 1) * H);
for (let x = 0; x < 230; x++) { const y = Math.round(45 + 30 * Math.sin(x / 14) * Math.exp(-x / 160)); for (let t = -1; t <= 1; t++) { const yy = y + t; if (yy >= 0 && yy < H) { const o = yy * (W * 4 + 1) + 1 + x * 4; raw[o] = 14; raw[o + 1] = 19; raw[o + 2] = 17; raw[o + 3] = 255; } } }
const chunk = (t: string, d: Buffer) => { const b = Buffer.concat([Buffer.from(t), d]); const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(b)); return Buffer.concat([l, b, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
await submitSignature(s2.token, { name: "Casey Morgan", method: "drawn", image: `data:image/png;base64,${png.toString("base64")}`, consent: true }, {});
const doc = await db.contractDocument.findFirstOrThrow({ where: { contractId: acc2.contractId } });
writeFileSync("docs/showcase/signed-agreement-drawn.pdf", Buffer.from(doc.bytes));

// typed-signature PDF
const p3 = await createProposal(ctx, lead.customerId, null, { ...draft, title: "Third proposal (showcase)" });
const sent3 = await sendProposal(ctx, p3.id, "casey@harbour.example");
const acc3 = await acceptProposal(sent3.token, { name: "Casey Morgan", consent: true }, {});
const s3 = await sendForSigning(ctx, acc3.contractId, { name: "Casey Morgan", email: "casey@harbour.example" });
await submitSignature(s3.token, { name: "Casey Morgan", method: "typed", consent: true }, {});
writeFileSync("docs/showcase/signed-agreement-typed.pdf", Buffer.from((await db.contractDocument.findFirstOrThrow({ where: { contractId: acc3.contractId } })).bytes));

writeFileSync("/tmp/claude-0/showcase.json", JSON.stringify({ proposal: portalLink(`/p/${sent3.token === "" ? "" : ""}`), proposalOpen: portalLink(`/p/${(await (async()=>{ const q = await createProposal(ctx, lead.customerId, null, { ...draft, title: "Website build and care plan" }); return (await sendProposal(ctx, q.id, "casey@harbour.example")).token; })())}`), sign: portalLink(`/s/${s1.token}`) }));
console.log("ok");
process.exit(0);
