/**
 * Agreements are stored as plain text with a tiny markup so the signed text is exactly what was shown:
 *   party: Label | Name | line one ; line two
 *   ## Section heading            (numbered automatically)
 *   1.1 Clause text               (clause number kept as written)
 *   - bullet
 *   note: highlighted note
 *   Sub-heading:                  (a line ending in ":" and short, or a known label)
 * Everything else is a paragraph. Blank lines are spacing.
 */
export type Block =
  | { t: "party"; label: string; name: string; lines: string[] }
  | { t: "h"; no: string; text: string }
  | { t: "sub"; text: string }
  | { t: "clause"; n: string; text: string }
  | { t: "bullet"; text: string }
  | { t: "note"; text: string }
  | { t: "p"; text: string }
  | { t: "gap" };

const SUBS = new Set(["Deliverables", "Exclusions", "Revisions"]);

export function parseDoc(text: string): Block[] {
  const out: Block[] = [];
  let section = 0;
  for (const raw of text.split("\n")) {
    const l = raw.trimEnd();
    if (!l.trim()) { if (out.length && out[out.length - 1].t !== "gap") out.push({ t: "gap" }); continue; }
    let m: RegExpMatchArray | null;
    if ((m = l.match(/^party:\s*([^|]*)\|([^|]*)\|?(.*)$/i))) out.push({ t: "party", label: m[1].trim(), name: m[2].trim(), lines: m[3].split(";").map((s) => s.trim()).filter(Boolean) });
    else if ((m = l.match(/^##\s+(.*)$/))) out.push({ t: "h", no: String(++section).padStart(2, "0"), text: m[1].trim() });
    else if ((m = l.match(/^note:\s*(.*)$/i))) out.push({ t: "note", text: m[1].trim() });
    else if ((m = l.match(/^(\d+(?:\.\d+)+)\s+(.*)$/))) out.push({ t: "clause", n: m[1], text: m[2] });
    else if ((m = l.match(/^[-•]\s+(.*)$/))) out.push({ t: "bullet", text: m[1] });
    else if (SUBS.has(l.trim()) || (/^[A-Z][^.!?]{0,60}:$/.test(l.trim()))) out.push({ t: "sub", text: l.trim().replace(/:$/, "") });
    else out.push({ t: "p", text: l.trim() });
  }
  return out;
}

export const hasPlaceholders = (text: string) => /\[TBC[:\]]/i.test(text);
export const placeholderCount = (text: string) => (text.match(/\[TBC[:\]]/gi) ?? []).length;
