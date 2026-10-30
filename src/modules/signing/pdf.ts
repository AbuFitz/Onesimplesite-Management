import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { parseDoc } from "@/documents/parse";
import { WORDMARK_BOX, WORDMARK_COLOUR, WORDMARK_REVERSED } from "@/documents/wordmark";

const A4: [number, number] = [595.28, 841.89];
const M = 52;
const INK = rgb(0.055, 0.075, 0.067), MOSS = rgb(0.047, 0.416, 0.286), GREY = rgb(0.36, 0.38, 0.37), BONE = rgb(0.937, 0.922, 0.89), LINE = rgb(0.85, 0.84, 0.81);
const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

// Standard PDF fonts only cover WinAnsi; replace anything else so generation never throws.
const safe = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/•/g, "-").replace(/[^\x09\x0A\x20-\x7E\xA0-\xFF]/g, "?");

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
  signerName: string; signerEmail: string; method: "typed" | "drawn"; signatureImage?: Buffer;
  signedAtLondon: string; signedAtUtc: string; consentText: string; consentVersion: string;
  draftWording?: boolean;
};

/** Flattened, final agreement PDF in the OneSimpleSite document style. Generated once at signing and never rewritten. */
export async function buildSignedPdf(i: SignedPdfInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(i.title); pdf.setProducer("OneSimpleSite Manage"); pdf.setCreator("OneSimpleSite Manage");
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ital = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const W = A4[0] - M * 2;
  const FIRST_TOP = 150, OTHER_TOP = 76, BOTTOM = 58;

  let page = pdf.addPage(A4);
  let y = A4[1] - FIRST_TOP;
  const newPage = () => { page = pdf.addPage(A4); y = A4[1] - OTHER_TOP; };
  const ensure = (h: number) => { if (y - h < BOTTOM) newPage(); };
  const line = (t: string, f: PDFFont, size: number, color = INK, x = M, width = W, lead = 1.42) => {
    for (const l of wrap(safe(t), f, size, width)) { ensure(size * lead); if (l) page.drawText(l, { x, y: y - size, size, font: f, color }); y -= size * lead; }
  };

  const blocks = parseDoc(i.contentText);
  for (let k = 0; k < blocks.length; k++) {
    const b = blocks[k];
    if (b.t === "party") {
      const ps = [b]; while (blocks[k + 1]?.t === "party") ps.push(blocks[++k] as typeof b);
      const colW = (W - 12) / ps.length;
      const heights = ps.map((p) => 14 + 13 + p.lines.reduce((n, l) => n + wrap(safe(l), reg, 9, colW - 20).length * 12.5, 0) + 12);
      const h = Math.max(...heights);
      ensure(h + 8);
      ps.forEach((p, n) => {
        const x = M + n * (colW + 12);
        page.drawRectangle({ x, y: y - h, width: colW, height: h, color: BONE });
        page.drawText(safe(p.label.toUpperCase()), { x: x + 10, y: y - 16, size: 7, font: bold, color: MOSS });
        page.drawText(safe(p.name), { x: x + 10, y: y - 30, size: 10.5, font: bold, color: INK });
        let ly = y - 31;
        for (const l of p.lines) for (const w of wrap(safe(l), reg, 9, colW - 20)) { ly -= 12.5; page.drawText(w, { x: x + 10, y: ly, size: 9, font: reg, color: INK }); }
      });
      y -= h + 14;
    } else if (b.t === "h") {
      ensure(48);
      y -= 12;
      page.drawText(b.no, { x: M, y: y - 11, size: 8, font: reg, color: MOSS });
      page.drawText(safe(b.text.toUpperCase()), { x: M + 24, y: y - 12, size: 11, font: bold, color: INK });
      y -= 18;
      page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.4, color: LINE });
      y -= 8;
    } else if (b.t === "tsec") {
      ensure(40); y -= 8;
      page.drawText(b.no, { x: M, y: y - 10, size: 8, font: reg, color: MOSS });
      page.drawText(safe(b.text), { x: M + 34, y: y - 11, size: 10.5, font: bold, color: INK });
      y -= 20;
    } else if (b.t === "sub") { y -= 4; line(b.text, bold, 10); }
    else if (b.t === "clause") {
      const ls = wrap(safe(b.text), reg, 9.5, W - 34);
      ensure(13.5);
      page.drawText(b.n, { x: M, y: y - 9.5, size: 8, font: reg, color: MOSS });
      for (const l of ls) { ensure(13.5); page.drawText(l, { x: M + 34, y: y - 9.5, size: 9.5, font: reg, color: INK }); y -= 13.5; }
      y -= 2;
    } else if (b.t === "bullet") { line(`-  ${b.text}`, reg, 9.5, INK, M + 8, W - 8); }
    else if (b.t === "note") {
      const ls = wrap(safe(b.text), reg, 9, W - 20); const h = ls.length * 12.5 + 14;
      y -= 8; ensure(h + 6); page.drawRectangle({ x: M, y: y - h, width: W, height: h, color: BONE });
      ls.forEach((l, n) => page.drawText(l, { x: M + 10, y: y - 16 - n * 12.5, size: 9, font: reg, color: INK })); y -= h + 8;
    } else if (b.t === "p") line(b.text, reg, 9.5);
    else y -= 5;
  }

  // Signature block, kept together on one page.
  y -= 10; ensure(215);
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.6, color: GREY }); y -= 14;
  line("Signed electronically", bold, 12); y -= 2;
  line(`${i.signerName} (${i.signerEmail})`, reg, 11);
  line(`${i.signedAtLondon} (Europe/London)`, reg, 10, GREY); y -= 4;
  if (i.method === "drawn" && i.signatureImage) {
    const img = await pdf.embedPng(i.signatureImage);
    const s = Math.min(200 / img.width, 60 / img.height);
    ensure(img.height * s + 10);
    page.drawImage(img, { x: M, y: y - img.height * s, width: img.width * s, height: img.height * s });
    y -= img.height * s + 8;
  } else { ensure(40); page.drawText(safe(i.signerName), { x: M, y: y - 24, size: 24, font: ital, color: INK }); y -= 34; }
  page.drawLine({ start: { x: M, y }, end: { x: M + 240, y }, thickness: 0.5, color: GREY }); y -= 14;
  line(`Method: ${i.method === "drawn" ? "drawn signature" : "typed name"}. Consent given (wording ${i.consentVersion}): ${i.consentText}`, reg, 8.5, GREY); y -= 4;
  line(`Agreement text SHA-256: ${i.contentSha256}`, reg, 7.5, GREY);
  line(`Recorded ${i.signedAtUtc} UTC. This is an electronic signature capture and does not verify the signer's identity beyond control of the emailed link.`, reg, 7.5, GREY);

  // Masthead (page 1), slim header (other pages) and footer, drawn last when the page count is known.
  const pages = pdf.getPages();
  pages.forEach((p, n) => {
    if (n === 0) {
      p.drawRectangle({ x: 0, y: A4[1] - 128, width: A4[0], height: 128, color: INK });
      wordmark(p, WORDMARK_REVERSED, M, A4[1] - 30, 150);
      p.drawText(safe(i.title.toUpperCase()), { x: M, y: A4[1] - 88, size: i.title.length > 28 ? 17 : 22, font: bold, color: rgb(0.937, 0.922, 0.89), maxWidth: W });
      p.drawText(safe(`REF ${i.reference}   ·   ${i.signedAtLondon.split(",")[0]}`), { x: M, y: A4[1] - 112, size: 7.5, font: reg, color: rgb(0.62, 0.62, 0.6) });
      if (i.draftWording) p.drawText("DRAFT WORDING - NOT APPROVED", { x: A4[0] - M - 150, y: A4[1] - 112, size: 7.5, font: bold, color: rgb(0.31, 0.85, 0.63) });
    } else {
      wordmark(p, WORDMARK_COLOUR, M, A4[1] - 28, 90);
      p.drawText(safe(`${i.title}  ·  ${i.reference}`), { x: M + 150, y: A4[1] - 36, size: 7.5, font: reg, color: GREY, maxWidth: W - 150 });
      p.drawLine({ start: { x: M, y: A4[1] - 52 }, end: { x: M + W, y: A4[1] - 52 }, thickness: 0.4, color: LINE });
    }
    p.drawLine({ start: { x: M, y: 40 }, end: { x: M + W, y: 40 }, thickness: 0.4, color: LINE });
    p.drawRectangle({ x: M, y: 39.5, width: 40, height: 1.6, color: MOSS });
    p.drawText("onesimplesite.co.uk", { x: M, y: 26, size: 7, font: reg, color: GREY });
    p.drawText(safe(`${i.reference} · page ${n + 1} of ${pages.length}`), { x: A4[0] - M - 90, y: 26, size: 7, font: reg, color: GREY });
  });
  return Buffer.from(await pdf.save());
}
