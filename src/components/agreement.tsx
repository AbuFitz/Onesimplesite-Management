import { parseDoc, type Block } from "@/documents/parse";

/** Renders the frozen agreement text with the OneSimpleSite document styling. */
export function AgreementText({ text }: { text: string }) {
  const blocks = parseDoc(text);
  const out: React.ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.t === "party") {
      const parties: Extract<Block, { t: "party" }>[] = [];
      while (i < blocks.length && blocks[i].t === "party") parties.push(blocks[i++] as Extract<Block, { t: "party" }>);
      i--;
      out.push(
        <div key={`p${i}`} className="grid gap-3 sm:grid-cols-2 my-4">
          {parties.map((p) => (
            <div key={p.label + p.name} className="bg-soft rounded-[8px] px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[.12em] text-moss">{p.label}</p>
              <p className="font-bold">{p.name}</p>
              {p.lines.map((l) => <p key={l} className="text-sm leading-snug">{l}</p>)}
            </div>
          ))}
        </div>,
      );
    } else if (b.t === "h") {
      out.push(<h2 key={i} className="mt-8 mb-2 flex items-baseline gap-3 border-b border-line pb-1 text-[15px] font-extrabold uppercase tracking-tight"><span className="text-xs font-medium text-moss tabular-nums">{b.no}</span>{b.text}</h2>);
    } else if (b.t === "tsec") {
      out.push(<h3 key={i} className="mt-6 mb-1 flex items-baseline gap-3 text-[15px] font-bold"><span className="w-8 text-xs font-medium text-moss tabular-nums">{b.no}</span>{b.text}</h3>);
    } else if (b.t === "sub") {
      out.push(<h3 key={i} className="mt-4 mb-1 text-sm font-bold">{b.text}</h3>);
    } else if (b.t === "clause") {
      out.push(<p key={i} className="relative my-1.5 pl-11"><span className="absolute left-0 top-0 text-xs font-medium text-moss tabular-nums leading-6">{b.n}</span>{b.text}</p>);
    } else if (b.t === "bullet") {
      out.push(<p key={i} className="my-0.5 pl-5 relative"><span className="absolute left-1">•</span>{b.text}</p>);
    } else if (b.t === "note") {
      out.push(<p key={i} className="my-3 bg-soft rounded-[8px] px-4 py-3 text-sm">{b.text}</p>);
    } else if (b.t === "p") {
      out.push(<p key={i} className="my-1.5">{b.text}</p>);
    } else out.push(<div key={i} className="h-2" />);
  }
  return <article aria-label="Agreement text" className="leading-relaxed">{out}</article>;
}
