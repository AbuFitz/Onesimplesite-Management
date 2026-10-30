"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

type Section = { heading: string; clauses: string[] };

function parse(body: string): Section[] {
  const out: Section[] = [];
  for (const raw of body.replace(/\r\n?/g, "\n").split("\n")) {
    const l = raw.trim(); if (!l) continue;
    const h = l.match(/^#{2,3}\s+(.*)$/);
    if (h) { out.push({ heading: h[1].trim(), clauses: [] }); continue; }
    const c = l.replace(/^\d+(?:\.\d+)*\s+/, "");
    if (!out.length) out.push({ heading: "", clauses: [] });
    out[out.length - 1].clauses.push(c);
  }
  return out.length ? out : [{ heading: "", clauses: [""] }];
}
const serialise = (s: Section[]) =>
  s.filter((x) => x.heading.trim() || x.clauses.some((c) => c.trim()))
    .map((x, i) => [`## ${x.heading.trim() || "Untitled section"}`, ...x.clauses.filter((c) => c.trim()).map((c, j) => `${i + 1}.${j + 1} ${c.replace(/\s*\n\s*/g, " ").trim()}`)].join("\n")).join("\n\n");

/** Edit terms section by section. Numbers are looked after automatically; no markup to learn. */
/** True when the whole document is plain sections and numbered clauses, so it can be edited without any markup. */
export const canBuild = (body: string) => body.replace(/\r\n?/g, "\n").split("\n").every((l) => !l.trim() || /^#{2,3}\s/.test(l.trim()) || /^\d+(\.\d+)+\s/.test(l.trim()));

export function TermsBuilder({ initial, onChange }: { initial: string; onChange: (body: string) => void }) {
  const [secs, setSecs] = useState<Section[]>(() => parse(initial));
  const body = useMemo(() => serialise(secs), [secs]);
  useEffect(() => { onChange(body); }, [body, onChange]);
  const todo = secs.reduce((n, s) => n + s.clauses.filter((c) => /\[TBC:/i.test(c)).length, 0);
  const set = (i: number, f: (s: Section) => Section) => setSecs(secs.map((s, k) => (k === i ? f(s) : s)));
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= secs.length) return; const n = [...secs]; [n[i], n[j]] = [n[j], n[i]]; setSecs(n); };

  return (
    <div className="space-y-4">
      {todo > 0 && <p className="rounded-lg bg-[#fff6e5] px-3 py-2 text-sm text-warn">{todo} clause{todo > 1 ? "s" : ""} still say [TBC: …]. Replace them with the real wording before publishing.</p>}
      {secs.map((s, i) => (
        <section key={i} className="rounded-2xl border border-line p-4" aria-label={`Section ${i + 1}`}>
          <div className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-center text-sm font-semibold text-muted">{i + 1}</span>
            <input aria-label={`Section ${i + 1} heading`} className="field font-semibold" value={s.heading} placeholder="Section heading, e.g. Payment" onChange={(e) => set(i, (x) => ({ ...x, heading: e.target.value }))} />
            <button type="button" className="btn btn-quiet h-10 w-10 !p-0" aria-label="Move section up" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={16} /></button>
            <button type="button" className="btn btn-quiet h-10 w-10 !p-0" aria-label="Move section down" onClick={() => move(i, 1)} disabled={i === secs.length - 1}><ArrowDown size={16} /></button>
          </div>
          <ol className="mt-3 space-y-2">
            {s.clauses.map((c, j) => (
              <li key={j} className="flex items-start gap-2">
                <span className="mt-2.5 w-6 shrink-0 text-center text-xs text-muted">{i + 1}.{j + 1}</span>
                <textarea aria-label={`Clause ${i + 1}.${j + 1}`} rows={Math.min(8, Math.max(2, Math.ceil(c.length / 70)))} className={`field ${/\[TBC:/i.test(c) ? "!border-warn bg-[#fffaf0]" : ""}`} value={c}
                  onChange={(e) => set(i, (x) => ({ ...x, clauses: x.clauses.map((y, k) => (k === j ? e.target.value : y)) }))} />
                <button type="button" className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-soft hover:text-danger" aria-label={`Remove clause ${i + 1}.${j + 1}`} onClick={() => set(i, (x) => ({ ...x, clauses: x.clauses.filter((_, k) => k !== j) }))}><Trash2 size={15} /></button>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex items-center justify-between">
            <button type="button" className="inline-flex items-center gap-1.5 text-sm underline" onClick={() => set(i, (x) => ({ ...x, clauses: [...x.clauses, ""] }))}><Plus size={14} />Add a clause</button>
            <button type="button" className="text-sm text-muted underline hover:text-danger" onClick={() => setSecs(secs.filter((_, k) => k !== i))}>Remove section</button>
          </div>
        </section>
      ))}
      <button type="button" className="btn btn-quiet" onClick={() => setSecs([...secs, { heading: "", clauses: [""] }])}><Plus size={16} />Add a section</button>
    </div>
  );
}
