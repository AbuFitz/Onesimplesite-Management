"use client";
import { useActionState, useCallback, useMemo, useState } from "react";
import { AgreementText } from "./agreement";
import { LegalSheet, type SheetMeta } from "./legal-sheet";
import { TermsBuilder, canBuild } from "./terms-builder";
import { ErrorSummary } from "./ui";
import { renumberTerms } from "@/documents/parse";
import { splitIntro } from "@/modules/settings/legal-starters";
import { LEGAL, type LegalKind } from "@/modules/settings/legal-docs";

const CHEAT = [["## Heading", "A numbered section"], ["1.1 Text", "A numbered clause"], ["- Text", "A bullet"], ["kv: Label | Value", "A details row"], ["| a | b | c |", "A table row (first row is the header)"], ["sign: For the Client", "A signature box"], ["note: Text", "A highlighted note"]];

/** Edit on one side, see the finished document on the other. On a phone the two are tabs. */
export function LegalEditor({ id, kind, initialTitle, initialBody, meta, saveAction, saveLabel }: {
  id: string; kind: LegalKind; initialTitle: string; initialBody: string; meta: Omit<SheetMeta, "title">; saveLabel: string;
  saveAction: (prev: unknown, fd: FormData) => Promise<{ error?: string }>;
}) {
  const [s, act, pending] = useActionState(saveAction, undefined as { error?: string } | undefined);
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [plain, setPlain] = useState(() => !canBuild(initialBody));
  const onBuild = useCallback((b: string) => setBody(b), []);
  const preview = useMemo(() => {
    if (kind === "terms") return { intro: undefined, text: renumberTerms(body) };
    const { intro, rest } = splitIntro(body);
    return { intro, text: rest };
  }, [body, kind]);
  const m = LEGAL[kind];
  const pane = (t: "edit" | "preview") => (tab === t ? "block" : "hidden xl:block");

  return (
    <form action={act}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="kind" value={kind} /><input type="hidden" name="body" value={body} />
      <div className="mb-4 flex gap-1 rounded-lg border border-line p-0.5 xl:hidden" role="group" aria-label="View">
        {(["edit", "preview"] as const).map((t) => <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)} className={`flex-1 rounded-md py-2 text-sm ${tab === t ? "bg-soft font-semibold" : "text-muted"}`}>{t === "edit" ? "Edit" : "Preview"}</button>)}
      </div>
      <div className="grid gap-8 xl:grid-cols-2">
        <section aria-label="Edit" className={`${pane("edit")} min-w-0 space-y-4`}>
          <ErrorSummary message={s?.error} />
          <div><label className="label" htmlFor="lg-title">Title</label><input id="lg-title" name="title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div className="flex items-center justify-between"><p className="label !mb-0">Wording</p>
            {canBuild(body) && <button type="button" className="text-sm underline" onClick={() => setPlain(!plain)}>{plain ? "Edit section by section" : "Edit as text"}</button>}</div>
          {plain || !canBuild(body) ? (
            <div>
              <label className="sr-only" htmlFor="lg-body">Wording as text</label>
              <textarea id="lg-body" className="field min-h-[50dvh] font-mono text-sm" value={body} onChange={(e) => setBody(e.target.value)} spellCheck />
              <details className="mt-2 text-sm"><summary className="cursor-pointer text-muted">How to lay it out</summary>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">{CHEAT.map(([a, b]) => <div key={a} className="contents"><dt className="font-mono text-xs">{a}</dt><dd className="text-muted">{b}</dd></div>)}</dl></details>
            </div>
          ) : <TermsBuilder initial={body} onChange={onBuild} />}
          <p className="hint">Anything marked <strong>[TBC: …]</strong> is still to be decided. Replace it with the real wording; publishing is blocked until none are left.</p>
          <button className="btn" disabled={pending}>{pending ? "Saving…" : saveLabel}</button>
        </section>
        <section aria-label="Preview" className={`${pane("preview")} min-w-0`}>
          <div className="rounded-2xl bg-[#e4e7e5] p-3 sm:p-6 xl:sticky xl:top-20 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto">
            <LegalSheet meta={{ ...meta, title: kind === "terms" ? m.label : title }} intro={preview.intro}><AgreementText text={preview.text} /></LegalSheet>
          </div>
        </section>
      </div>
    </form>
  );
}
