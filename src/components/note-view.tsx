import type { ReactNode } from "react";

/** Inline: **bold**, *italic*, `code`, [text](https://link). Built as React nodes, never raw HTML. */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
  let last = 0, i = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0], k = `${key}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={k} className="rounded bg-soft px-1.5 py-0.5 text-[0.9em]">{t.slice(1, -1)}</code>);
    else if (t.startsWith("[")) { const [, label, href] = t.match(/^\[([^\]]+)\]\((.+)\)$/)!; out.push(<a key={k} href={href} target="_blank" rel="noopener noreferrer" className="text-moss underline">{label}</a>); }
    else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** The formatted reading view of a page. To-do boxes call onToggle with the line they live on. */
export function NoteView({ body, onToggle }: { body: string; onToggle?: (line: number) => void }) {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const out: ReactNode[] = [];
  lines.forEach((raw, i) => {
    const k = `l${i}`, l = raw.trimEnd();
    let m: RegExpMatchArray | null;
    if (!l.trim()) out.push(<div key={k} className="h-3" />);
    else if ((m = l.match(/^(#{1,3})\s+(.*)$/))) {
      const cls = m[1].length === 1 ? "mt-6 text-3xl font-bold" : m[1].length === 2 ? "mt-5 text-2xl font-semibold" : "mt-4 text-xl font-semibold";
      out.push(<p key={k} role="heading" aria-level={m[1].length + 1} className={cls}>{inline(m[2], k)}</p>);
    } else if ((m = l.match(/^[-*]\s+\[( |x|X)\]\s+(.*)$/))) {
      const done = m[1] !== " ";
      out.push(
        <label key={k} className="my-1 flex cursor-pointer items-start gap-2.5">
          <input type="checkbox" checked={done} disabled={!onToggle} onChange={() => onToggle?.(i)} className="mt-1.5 h-4 w-4 accent-[#0c6a49]" />
          <span className={done ? "text-muted line-through" : ""}>{inline(m[2], k)}</span>
        </label>,
      );
    } else if ((m = l.match(/^[-*]\s+(.*)$/))) out.push(<p key={k} className="relative my-0.5 pl-5"><span aria-hidden className="absolute left-1">•</span>{inline(m[1], k)}</p>);
    else if ((m = l.match(/^(\d+)\.\s+(.*)$/))) out.push(<p key={k} className="relative my-0.5 pl-6"><span aria-hidden className="absolute left-0 tabular-nums text-muted">{m[1]}.</span>{inline(m[2], k)}</p>);
    else if ((m = l.match(/^>\s?(.*)$/))) out.push(<blockquote key={k} className="my-1 border-l-[3px] border-line pl-4 text-muted">{inline(m[1], k)}</blockquote>);
    else if (/^-{3,}$/.test(l.trim())) out.push(<hr key={k} className="my-4 border-line" />);
    else out.push(<p key={k} className="my-0.5">{inline(l, k)}</p>);
  });
  return <div className="text-[16px] leading-relaxed">{out}</div>;
}
