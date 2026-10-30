import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

const A4: [number, number] = [595.28, 841.89];
const M = 56;

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
// Standard PDF fonts only cover WinAnsi; replace anything else so generation never throws.
const safe = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/[^\x09\x0A\x20-\x7E\xA0-\xFF]/g, "?");

export type SignedPdfInput = {
  title: string; reference: string; contentText: string; contentSha256: string;
  signerName: string; signerEmail: string; method: "typed" | "drawn"; signatureImage?: Buffer;
  signedAtLondon: string; signedAtUtc: string; consentText: string; consentVersion: string;
};

/** Flattened, final agreement PDF. Generated once at signing and never rewritten. */
export async function buildSignedPdf(i: SignedPdfInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(i.title); pdf.setProducer("OneSimpleSite Manage"); pdf.setCreator("OneSimpleSite Manage");
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ital = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const ink = rgb(0.055, 0.075, 0.067), grey = rgb(0.36, 0.38, 0.37);
  const W = A4[0] - M * 2;

  let page = pdf.addPage(A4); let y = A4[1] - M;
  const newPage = () => { page = pdf.addPage(A4); y = A4[1] - M; };
  const ensure = (h: number) => { if (y - h < M + 24) newPage(); };
  const write = (t: string, f: PDFFont, size: number, color = ink, lead = 1.4) => {
    for (const l of wrap(safe(t), f, size, W)) { ensure(size * lead); if (l) page.drawText(l, { x: M, y: y - size, size, font: f, color }); y -= size * lead; }
  };
  const HEADINGS = new Set(["Scope and terms", "Price", "Deliverables", "Exclusions", "Revisions"]);
  const writeBody = (t: string) => { for (const l of t.split("\n")) { if (HEADINGS.has(l.trim())) { y -= 4; write(l, bold, 11); } else write(l, reg, 10.5); } };

  write("onesimplesite", bold, 14); y -= 14;
  write(i.title, bold, 20, ink, 1.3); y -= 4;
  write(`Reference ${i.reference}`, reg, 10, grey); y -= 14;
  writeBody(i.contentText);
  y -= 12; ensure(212); // keep the whole signature block together on one page
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.6, color: grey }); y -= 14;
  write("Signed electronically", bold, 12); y -= 2;
  write(`${i.signerName} (${i.signerEmail})`, reg, 11);
  write(`${i.signedAtLondon} (Europe/London)`, reg, 10, grey); y -= 4;
  if (i.method === "drawn" && i.signatureImage) {
    const img = await pdf.embedPng(i.signatureImage);
    const s = Math.min(200 / img.width, 60 / img.height);
    ensure(img.height * s + 10);
    page.drawImage(img, { x: M, y: y - img.height * s, width: img.width * s, height: img.height * s });
    y -= img.height * s + 8;
  } else {
    ensure(40); page.drawText(safe(i.signerName), { x: M, y: y - 24, size: 24, font: ital, color: ink }); y -= 34;
  }
  page.drawLine({ start: { x: M, y }, end: { x: M + 240, y }, thickness: 0.5, color: grey }); y -= 14;
  write(`Method: ${i.method === "drawn" ? "drawn signature" : "typed name"}. Consent given (wording ${i.consentVersion}): ${i.consentText}`, reg, 9, grey); y -= 4;
  write(`Agreement text SHA-256: ${i.contentSha256}`, reg, 8, grey);
  write(`Recorded ${i.signedAtUtc} UTC. This is an electronic signature capture and does not verify the signer's identity beyond control of the emailed link.`, reg, 8, grey);

  const pages = pdf.getPages();
  pages.forEach((p, n) => p.drawText(`${safe(i.reference)} · page ${n + 1} of ${pages.length}`, { x: M, y: 28, size: 8, font: reg, color: grey }));
  return Buffer.from(await pdf.save());
}
