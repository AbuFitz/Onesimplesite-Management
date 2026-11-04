import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { parseDoc } from "@/documents/parse";
import { WORDMARK_BOX, WORDMARK_COLOUR, WORDMARK_REVERSED } from "@/documents/wordmark";
import { MAST_PNG, WISPS_JPG, WISPS_FLIP_JPG } from "@/documents/art";

const A4: [number, number] = [595.28, 841.89];
const M = 51; // 18mm gutter, as in the template
const INK = rgb(0.055, 0.075, 0.067), MOSS = rgb(0.047, 0.416, 0.286), GREY = rgb(0.36, 0.38, 0.37), BONE = rgb(0.937, 0.922, 0.89), LINE = rgb(0.85, 0.84, 0.81);
const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

// Standard PDF fonts only cover WinAnsi; replace anything else so generation never throws.
const safe = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—−]/g, "-").replace(/…/g, "...").replace(/•/g, "-").replace(/[^\x09\x0A\x20-\x7E\xA0-\xFF]/g, "?");

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (!para.trim()) { out.push(""); continue; }
    let line = "";
    for (const word of para.split(/\s+/)) {
      const t = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(t, size) > width && line) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}

/** Draws the outlined wordmark as vector paths (crisp at any zoom). */
function wordmark(page: PDFPage, paths: { fill: string; d: string }[], x: number, yTop: number, width: number) {
  const s = width / WORDMARK_BOX.w;
  for (const p of paths) page.drawSvgPath(p.d, { x: x - WORDMARK_BOX.x * s, y: yTop + WORDMARK_BOX.y * s, scale: s, color: hex(p.fill), borderWidth: 0 });
  return WORDMARK_BOX.h * s;
}

export type SignedPdfInput = {
  title: string; reference: string; contentText: string; contentSha256: string;
  signerName: string; signerPosition?: string; signerEmail: string; method: "typed" | "drawn"; signatureImage?: Buffer;
  signedAtLondon: string; signedAtUtc: string; consentText: string; consentVersion: string;
  draftWording?: boolean;
  /** A review copy sent before signing: blank signature block, no signing record. */
  unsigned?: boolean;
  /** Shown top right of the first page, e.g. the customer company. */
  preparedFor?: string;
};

/** Flattened, final agreement PDF in the OneSimpleSite document design. Generated once at signing and never rewritten. */
export async function buildSignedPdf(i: SignedPdfInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(i.title); pdf.setProducer("OneSimpleSite Manage"); pdf.setCreator("OneSimpleSite Manage");
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ital = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const monoB = await pdf.embedFont(StandardFonts.CourierBold);
  const [mastImg, wispA, wispB] = [await pdf.embedPng(Buffer.from(MAST_PNG, "base64")), await pdf.embedJpg(Buffer.from(WISPS_JPG, "base64")), await pdf.embedJpg(Buffer.from(WISPS_FLIP_JPG, "base64"))];
  const W = A4[0] - M * 2, H = A4[1];
  const SPRING = hex("#4fd9a0"), HAIR = rgb(0.86, 0.865, 0.86), BONE_T = rgb(0.937, 0.922, 0.89);
  const FIRST_TOP = 198, OTHER_TOP = 92, BOTTOM = 70;
  const day = i.signedAtLondon.split(/,| at /)[0];

  const upper = (t: string) => safe(t).toUpperCase();
  const rtext = (page: PDFPage, t: string, xRight: number, yy: number, size: number, font: PDFFont, color = INK) => page.drawText(t, { x: xRight - font.widthOfTextAtSize(t, size), y: yy, size, font, color });
  const roundRect = (page: PDFPage, x: number, yTop: number, w: number, h: number, r: number, color: ReturnType<typeof rgb>, opacity = 1) =>
    page.drawSvgPath(`M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`, { x, y: yTop, color, opacity, borderWidth: 0 });

  // Page furniture is drawn as each page starts: wisps behind everything, then the masthead or slim header.
  let page!: PDFPage; let y = 0;
  const startPage = () => {
    const n = pdf.getPageCount();
    page = pdf.addPage(A4);
    page.drawImage(n % 2 === 0 ? wispA : wispB, { x: 0, y: 0, width: A4[0], height: H });
    if (n === 0) {
      const mh = 112 * 2.835; // the artwork runs 112mm, dissolving into the page
      page.drawImage(mastImg, { x: 0, y: H - mh, width: A4[0], height: mh });
      wordmark(page, WORDMARK_REVERSED, M, H - 28, 142);
      rtext(page, upper(`Prepared for ${i.preparedFor ?? i.signerName}`), A4[0] - M, H - 47, 6.8, mono, BONE_T);
      const words = safe(i.title).toUpperCase().split(/\s+/); const last = words.pop() ?? "";
      const size = i.title.length > 26 ? 24 : 29; let tx = M; const ty = H - 100;
      for (const [k, wd] of [...words.map((w) => [w, false] as const), [last, true] as const].entries()) {
        void k; const txt = wd[0] + (wd[1] ? "" : " ");
        page.drawText(txt, { x: tx, y: ty, size, font: bold, color: wd[1] ? SPRING : BONE_T }); tx += bold.widthOfTextAtSize(txt, size);
      }
      let mx = M; const my = H - 118;
      for (const [k, v] of [["REF", i.reference], ["DATE", day.toUpperCase()], ["VERSION", "1.0"], ["STATUS", i.unsigned ? "FOR SIGNATURE" : i.draftWording ? "DRAFT" : "SIGNED"]]) {
        page.drawText(`${k} `, { x: mx, y: my, size: 6.6, font: mono, color: rgb(0.62, 0.62, 0.6) }); mx += mono.widthOfTextAtSize(`${k} `, 6.6);
        page.drawText(v, { x: mx, y: my, size: 6.6, font: monoB, color: BONE_T }); mx += monoB.widthOfTextAtSize(v, 6.6) + 22;
      }
      y = H - FIRST_TOP;
    } else {
      wordmark(page, WORDMARK_COLOUR, M, H - 26, 96);
      rtext(page, safe(`${i.title.toUpperCase()}   REF ${i.reference}`), A4[0] - M, H - 36, 6.6, mono, INK);
      page.drawLine({ start: { x: M, y: H - 62 }, end: { x: M + W, y: H - 62 }, thickness: 0.6, color: HAIR });
      page.drawRectangle({ x: M, y: H - 62.5, width: 62, height: 2.5, color: MOSS });
      y = H - OTHER_TOP;
    }
  };
  const ensure = (h: number) => { if (y - h < BOTTOM) startPage(); };
  const line = (t: string, f: PDFFont, size: number, color = INK, x = M, width = W, lead = 1.5) => {
    for (const l of wrap(safe(t), f, size, width)) { ensure(size * lead); if (l) page.drawText(l, { x, y: y - size, size, font: f, color }); y -= size * lead; }
  };
  startPage();

  const blocks = parseDoc(i.contentText);
  let firstPara = true;
  for (let k = 0; k < blocks.length; k++) {
    const b = blocks[k];
    if (b.t === "party") {
      const ps = [b]; while (blocks[k + 1]?.t === "party") ps.push(blocks[++k] as typeof b);
      const gap = 14, colW = (W - gap * (ps.length - 1)) / ps.length;
      const heights = ps.map((p) => 38 + p.lines.reduce((n, l) => n + wrap(safe(l), reg, 9, colW - 28).length * 13.2, 0) + 12);
      const h = Math.max(...heights);
      ensure(h + 10);
      ps.forEach((p, n) => {
        const x = M + n * (colW + gap);
        roundRect(page, x, y, colW, h, 6, BONE, 0.9);
        page.drawText(upper(p.label), { x: x + 14, y: y - 20, size: 7, font: bold, color: MOSS });
        page.drawText(safe(p.name), { x: x + 14, y: y - 36, size: 10, font: bold, color: INK });
        let ly = y - 36;
        for (const l of p.lines) for (const w of wrap(safe(l), reg, 9, colW - 28)) { ly -= 13.2; page.drawText(w, { x: x + 14, y: ly, size: 9, font: reg, color: INK }); }
      });
      y -= h + 16;
    } else if (b.t === "h") {
      ensure(64); y -= 14;
      page.drawText(b.no, { x: M, y: y - 9, size: 7.6, font: mono, color: MOSS });
      page.drawText(upper(b.text), { x: M + 34, y: y - 10, size: 11.5, font: bold, color: INK });
      y -= 21; page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.6, color: HAIR }); y -= 11;
    } else if (b.t === "tsec") {
      ensure(48); y -= 6;
      page.drawText(b.no, { x: M, y: y - 9, size: 7.6, font: mono, color: MOSS });
      page.drawText(safe(b.text), { x: M + 34, y: y - 10, size: 10.5, font: bold, color: INK });
      y -= 22;
    } else if (b.t === "sub") { y -= 4; line(b.text, bold, 10); }
    else if (b.t === "clause") {
      const ls = wrap(safe(b.text), reg, 9.5, W - 34);
      ensure(14.7);
      page.drawText(b.n, { x: M, y: y - 9.5, size: 8, font: mono, color: MOSS });
      for (const l of ls) { ensure(14.7); page.drawText(l, { x: M + 34, y: y - 9.5, size: 9.5, font: reg, color: INK }); y -= 14.7; }
      y -= 3;
    } else if (b.t === "bullet") {
      const ls = wrap(safe(b.text), reg, 9.5, W - 46); ensure(16);
      page.drawCircle({ x: M + 24, y: y - 6.4, size: 1.5, color: MOSS });
      for (const l of ls) { ensure(14.7); page.drawText(l, { x: M + 40, y: y - 9.5, size: 9.5, font: reg, color: INK }); y -= 14.7; }
      y -= 2;
    } else if (b.t === "note") {
      const ls = wrap(safe(b.text), reg, 9, W - 28); const h = ls.length * 13 + 16;
      y -= 6; ensure(h + 8); roundRect(page, M, y, W, h, 6, BONE, 0.86);
      ls.forEach((l, n) => page.drawText(l, { x: M + 14, y: y - 17 - n * 13, size: 9, font: reg, color: INK })); y -= h + 10;
    } else if (b.t === "kv") {
      const rows = [b]; while (blocks[k + 1]?.t === "kv") rows.push(blocks[++k] as typeof b);
      const lw = 128, vw = W - lw;
      page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.5, color: HAIR });
      for (const r of rows) {
        const vl = wrap(safe(r.value), reg, 8.8, vw - 6); const h = Math.max(1, vl.length) * 12.6 + 12;
        ensure(h);
        page.drawText(safe(r.label), { x: M, y: y - 14, size: 8.8, font: bold, color: INK });
        vl.forEach((l, n) => page.drawText(l, { x: M + lw, y: y - 14 - n * 12.6, size: 8.8, font: reg, color: INK }));
        y -= h; page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.5, color: HAIR });
      }
      y -= 12;
    } else if (b.t === "table") {
      const amt = b.head.map((h) => /^(amount|price|total)/i.test(h));
      const n = b.head.length; const fr = n === 3 && amt[2] ? [0.27, 0.5, 0.23] : b.head.map((_, j) => (amt[j] ? 0.2 : (1 - amt.filter(Boolean).length * 0.2) / (n - amt.filter(Boolean).length)));
      const xs = fr.map((_, j) => M + fr.slice(0, j).reduce((a, c) => a + c, 0) * W), ws = fr.map((f) => f * W);
      ensure(40);
      b.head.forEach((h, j) => { const t = upper(h); amt[j] ? rtext(page, t, xs[j] + ws[j], y - 8, 6.3, mono, MOSS) : page.drawText(t, { x: xs[j], y: y - 8, size: 6.3, font: mono, color: MOSS }); });
      y -= 14; page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.8, color: INK });
      for (const r of b.rows) {
        const cells = r.map((c, j) => wrap(safe(c), j === 0 ? bold : reg, 8.8, ws[j] - 10));
        const h = Math.max(1, ...cells.map((c) => c.length)) * 12.4 + 12; ensure(h);
        const total = /^total/i.test(r[0] ?? "");
        cells.forEach((lines, j) => lines.forEach((l, q) => { const f = j === 0 || total ? bold : reg; amt[j] ? rtext(page, l, xs[j] + ws[j], y - 14 - q * 12.4, 8.8, f) : page.drawText(l, { x: xs[j], y: y - 14 - q * 12.4, size: 8.8, font: f, color: INK }); }));
        y -= h; page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.5, color: total ? INK : HAIR });
      }
      y -= 12;
    } else if (b.t === "sign") {
      const group = [b]; while (blocks[k + 1]?.t === "sign" || (blocks[k + 1]?.t === "gap" && blocks[k + 2]?.t === "sign")) { if (blocks[k + 1].t === "gap") k++; group.push(blocks[++k] as typeof b); }
      const colW = (W - 28) / Math.max(2, group.length), H0 = 168; ensure(H0 + 10); y -= 8;
      for (const [n, g] of group.entries()) {
        const x = M + n * (colW + 28), client = /^accepted by/i.test(g.label);
        page.drawText(upper(g.label), { x, y: y - 8, size: 7, font: bold, color: MOSS });
        const field = (label: string, yy: number) => { page.drawText(label, { x, y: yy, size: 6.2, font: mono, color: MOSS }); page.drawLine({ start: { x, y: yy - 30 }, end: { x: x + colW, y: yy - 30 }, thickness: 0.8, color: INK }); };
        field("SIGNATURE", y - 28); field("NAME", y - 76); field("POSITION", y - 112); field("DATE", y - 148);
        const sigTop = y - 40;
        if (client && i.unsigned) { /* left blank for the signer */ }
        else if (client && i.method === "drawn" && i.signatureImage) { const img = await pdf.embedPng(i.signatureImage); const sc = Math.min((colW - 6) / img.width, 36 / img.height); page.drawImage(img, { x: x + 2, y: sigTop - img.height * sc + 8, width: img.width * sc, height: img.height * sc }); }
        else if (client) page.drawText(safe(i.signerName), { x: x + 2, y: sigTop - 14, size: 17, font: ital, color: INK, maxWidth: colW - 6 });
        else if (g.typed) page.drawText(safe(g.typed), { x: x + 2, y: sigTop - 14, size: 17, font: ital, color: INK, maxWidth: colW - 6 });
        const fill = (t: string | undefined, yy: number) => t && page.drawText(safe(t), { x: x + 2, y: yy - 18, size: 9.5, font: reg, color: INK, maxWidth: colW - 6 });
        if (!(client && i.unsigned)) { fill(client ? i.signerName : g.name, y - 76); fill(client ? i.signerPosition : g.position, y - 112); fill(client ? day : g.date, y - 148); }
      }
      y -= H0 + 6;
    } else if (b.t === "p") { if (firstPara) { line(b.text, bold, 10.5, INK, M, W, 1.5); y -= 8; firstPara = false; } else line(b.text, reg, 9.5); }
    else y -= 5;
    if (b.t !== "gap" && b.t !== "p") firstPara = false;
  }

  // Evidence, kept together at the end.
  y -= 6; ensure(66);
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.5, color: HAIR }); y -= 12;
  if (i.unsigned) { line("Review copy. This has not been signed yet. The signed copy is emailed to you once you sign.", bold, 8, INK, M, W, 1.5); line(`Agreement text SHA-256: ${i.contentSha256}`, mono, 6.8, GREY, M, W, 1.5); }
  else {
  line(`Signed electronically by ${i.signerName} (${i.signerEmail}) on ${i.signedAtLondon} (Europe/London). Method: ${i.method === "drawn" ? "drawn signature" : "typed name"}.`, bold, 8, INK, M, W, 1.5);
  line(`Consent given (wording ${i.consentVersion}): ${i.consentText}`, reg, 7.5, GREY, M, W, 1.5);
  line(`Agreement text SHA-256: ${i.contentSha256}`, mono, 6.8, GREY, M, W, 1.5);
  line(`Recorded ${i.signedAtUtc} UTC. This is an electronic signature capture and does not verify the signer's identity beyond control of the emailed link.`, reg, 7, GREY, M, W, 1.5);
  }

  // Footers once the page count is known.
  const pages = pdf.getPages();
  pages.forEach((p, n) => {
    p.drawLine({ start: { x: M, y: 44 }, end: { x: M + W, y: 44 }, thickness: 0.6, color: HAIR });
    p.drawRectangle({ x: M, y: 43, width: 62, height: 2.5, color: MOSS });
    p.drawText("ONESIMPLESITE.CO.UK", { x: M, y: 27, size: 6.4, font: mono, color: GREY });
    const mid = i.draftWording ? "DRAFT WORDING - NOT APPROVED" : "PRIVATE & CONFIDENTIAL"; p.drawText(mid, { x: (A4[0] - mono.widthOfTextAtSize(mid, 6.4)) / 2, y: 27, size: 6.4, font: mono, color: GREY });
    rtext(p, `PAGE ${n + 1} / ${pages.length}`, A4[0] - M, 27, 6.4, mono, GREY);
  });
  return Buffer.from(await pdf.save());
}
