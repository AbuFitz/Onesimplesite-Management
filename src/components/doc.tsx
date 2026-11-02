import Image from "next/image";
import type { ReactNode } from "react";
import { parseDoc, type Block } from "@/documents/parse";

export type DocMeta = {
  title: string; ref: string; date: string; version: string; status: string;
  /** Top right of the masthead, e.g. "Prepared for Acme Ltd" or "Customer-facing". */
  mark: string;
  /** Bottom marking, e.g. "Private & confidential". */
  footMark?: string;
};

/** The last word of the title picks up the spring-green accent, as in the document template. */
function Title({ text }: { text: string }) {
  const words = text.trim().split(/\s+/);
  const last = words.pop() ?? "";
  return <h1 className="d-title">{words.length ? `${words.join(" ")} ` : ""}<em>{last}</em></h1>;
}

/** One A4-style document: aurora masthead, wisps behind the text, numbered sections, footer. */
export function DocSheet({ meta, children, footer }: { meta: DocMeta; children: ReactNode; footer?: ReactNode }) {
  return (
    <article className="d-sheet" aria-label={meta.title}>
      <div className="d-wisps" aria-hidden />
      <header className="d-mast">
        <div className="d-mast-bg" aria-hidden />
        <div className="d-mast-top">
          <Image className="d-wm" src="/brand/wordmark-reversed-colour.svg" alt="OneSimpleSite" width={188} height={30} priority />
          <span className="d-mono">{meta.mark}</span>
        </div>
        <Title text={meta.title} />
        <div className="d-meta">
          <span>Ref <b>{meta.ref}</b></span><span>Date <b>{meta.date}</b></span><span>Version <b>{meta.version}</b></span><span>Status <b>{meta.status}</b></span>
        </div>
      </header>
      <div className="d-body">{children}</div>
      {footer}
      <footer className="d-foot"><span>onesimplesite.co.uk</span><span>{meta.footMark ?? "Private & confidential"}</span><span>Ref <b>{meta.ref}</b></span></footer>
    </article>
  );
}

const MONEY = /^£[\d,]+(\.\d{2})?(\s.*)?$/;

/** Renders agreement markup (see documents/parse.ts) in the document design. */
export function DocBody({ text, hideSign }: { text: string; hideSign?: (label: string) => boolean }) {
  const blocks = parseDoc(text);
  const out: ReactNode[] = [];
  let seenHeading = false;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.t === "party") {
      const parties: Extract<Block, { t: "party" }>[] = [];
      while (i < blocks.length && blocks[i].t === "party") parties.push(blocks[i++] as Extract<Block, { t: "party" }>);
      i--;
      out.push(
        <div key={`p${i}`} className="d-parties">
          {parties.map((p) => (
            <div key={p.label + p.name} className="d-panel">
              <span className="d-pill">{p.label}</span>
              <p><b>{p.name}</b></p>
              {p.lines.map((l) => <p key={l}>{l}</p>)}
            </div>
          ))}
        </div>,
      );
    } else if (b.t === "kv") {
      const rows: Extract<Block, { t: "kv" }>[] = [];
      while (i < blocks.length && blocks[i].t === "kv") rows.push(blocks[i++] as Extract<Block, { t: "kv" }>);
      i--;
      out.push(<div key={`kv${i}`} className="d-tblwrap"><table className="d-tbl kv"><tbody>{rows.map((r, k) => <tr key={k}><td>{r.label}</td><td>{r.value}</td></tr>)}</tbody></table></div>);
    } else if (b.t === "table") {
      const money = b.head.map((h) => /^(amount|price|total)/i.test(h));
      out.push(
        <div key={i} className="d-tblwrap"><table className="d-tbl">
          <thead><tr>{b.head.map((h, k) => <th key={k} scope="col" className={money[k] ? "amt" : ""}>{h}</th>)}</tr></thead>
          <tbody>{b.rows.map((r, k) => {
            const total = /^total/i.test(r[0] ?? "");
            return <tr key={k} className={total ? "total" : ""}>{r.map((c, j) => <td key={j} className={money[j] || (MONEY.test(c) && j === r.length - 1) ? "amt" : ""}>{c}</td>)}</tr>;
          })}</tbody>
        </table></div>,
      );
    } else if (b.t === "sign") {
      const group: Extract<Block, { t: "sign" }>[] = [];
      while (i < blocks.length && (blocks[i].t === "sign" || blocks[i].t === "gap")) { const x = blocks[i++]; if (x.t === "sign") group.push(x); }
      i--;
      const shown = group.filter((g) => !hideSign?.(g.label));
      if (shown.length) out.push(
        <div key={`s${i}`} className="d-sigs">
          {shown.map((g) => (
            <div key={g.label} className="d-sig">
              <span className="d-pill">{g.label}</span>
              {g.typed ? <div className="d-row"><span className="lb">Signature</span><div className="ln tall typed">{g.typed}</div></div> : <div className="d-row"><span className="lb">Signature</span><div className="ln tall" /></div>}
              {(["Name", "Position", "Date"] as const).map((f) => { const v = f === "Name" ? g.name : f === "Position" ? g.position : g.date; return <div key={f} className="d-row"><span className="lb">{f}</span><div className="ln">{v}</div></div>; })}
            </div>
          ))}
        </div>,
      );
    } else if (b.t === "h") { seenHeading = true; out.push(<div key={i} className="d-sec"><span className="no">{b.no}</span><h2>{b.text}</h2></div>);
    } else if (b.t === "tsec") out.push(<div key={i} className="d-sec d-tsec"><span className="no">{b.no}</span><h2>{b.text}</h2></div>);
    else if (b.t === "sub") out.push(<p key={i} className="d-subh">{b.text}</p>);
    else if (b.t === "clause") out.push(<p key={i} className="d-cl"><span className="n">{b.n}</span>{b.text}</p>);
    else if (b.t === "bullet") out.push(<p key={i} className="d-li">{b.text}</p>);
    else if (b.t === "note") out.push(<div key={i} className="d-note"><p>{b.text}</p></div>);
    else if (b.t === "p") out.push(<p key={i} className={seenHeading ? "" : "d-lead"}>{b.text}</p>);
    else out.push(<div key={i} style={{ height: 6 }} />);
  }
  return <div className="d-text">{out}</div>;
}
