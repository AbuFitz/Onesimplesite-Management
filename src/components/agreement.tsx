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
    } else if (b.t === "kv") {
      const rows: Extract<Block, { t: "kv" }>[] = [];
      while (i < blocks.length && blocks[i].t === "kv") rows.push(blocks[i++] as Extract<Block, { t: "kv" }>);
      i--;
      out.push(
        <dl key={`kv${i}`} className="my-3 overflow-hidden rounded-[8px] border border-line text-sm">
          {rows.map((r, k) => (
            <div key={k} className={`grid gap-1 px-4 py-2.5 sm:grid-cols-[11rem_1fr] ${k ? "border-t border-line" : ""}`}>
              <dt className="font-semibold text-muted">{r.label}</dt><dd className="break-words">{r.value}</dd>
            </div>
          ))}
        </dl>,
      );
    } else if (b.t === "table") {
      out.push(
        <div key={i} className="my-3 overflow-x-auto rounded-[8px] border border-line">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead className="bg-soft"><tr>{b.head.map((h, k) => <th key={k} scope="col" className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted">{h}</th>)}</tr></thead>
            <tbody>{b.rows.map((r, k) => <tr key={k} className="border-t border-line align-top">{r.map((c, j) => <td key={j} className={`px-3 py-2 ${j === 0 ? "font-medium" : ""}`}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
    } else if (b.t === "sign") {
      out.push(
        <div key={i} className="my-4 break-inside-avoid rounded-[8px] border border-line p-4">
          <p className="mb-3 text-sm font-bold">{b.label}</p>
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {["Signature", "Name", "Position", "Date"].map((f) => <div key={f}><div className="h-7 border-b border-[#8f9993]" /><p className="mt-1 text-xs text-muted">{f}</p></div>)}
          </div>
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
