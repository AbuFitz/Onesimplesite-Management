import type { ReactNode } from "react";

/** Plain text with @Full Name picked out, so a mention stands out in a reply. Built as nodes, never raw HTML. */
export function MentionText({ text, names }: { text: string; names: string[] }) {
  const list = [...names].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!list.length) return <>{text}</>;
  const re = new RegExp(`@(${list.join("|")})(?![\\p{L}\\p{N}])`, "giu");
  const out: ReactNode[] = []; let last = 0, i = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<mark key={i++} className="mention">{m[0]}</mark>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
