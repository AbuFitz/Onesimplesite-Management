const HEADINGS = new Set(["Scope and terms", "Price", "Deliverables", "Exclusions", "Revisions"]);
/** Renders frozen agreement text; known section labels are emphasised, everything else is verbatim. */
export function AgreementText({ text }: { text: string }) {
  return (
    <article aria-label="Agreement text" className="leading-relaxed">
      {text.split("\n").map((l, i) => HEADINGS.has(l.trim()) ? <h2 key={i} className="mt-6 mb-1 text-base">{l}</h2> : <p key={i} className="whitespace-pre-wrap min-h-[1em] my-0">{l}</p>)}
    </article>
  );
}
