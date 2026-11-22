import Link from "next/link";
import type { ReactNode } from "react";

/** The big figures at the top of a widget's summary. */
export function DetailStats({ stats }: { stats: { label: string; value: ReactNode; tone?: "good" | "warn" | "bad" }[] }) {
  return <dl className="dr-stats">{stats.map((s) => <div key={s.label} data-tone={s.tone}><dt>{s.label}</dt><dd className="num">{s.value}</dd></div>)}</dl>;
}
/** A short list of the things behind the number, each one a way in. */
export function DetailList({ title, items, empty = "Nothing here." }: { title: string; items: { key: string; href?: string; title: string; sub?: ReactNode; end?: ReactNode }[]; empty?: string }) {
  return (
    <section className="dr-sec"><h3>{title}</h3>
      {items.length === 0 ? <p className="dr-empty">{empty}</p> : <ul>{items.map((i) => <li key={i.key}>{i.href ? <Link href={i.href}><span><b>{i.title}</b>{i.sub && <small>{i.sub}</small>}</span>{i.end}</Link> : <div><span><b>{i.title}</b>{i.sub && <small>{i.sub}</small>}</span>{i.end}</div>}</li>)}</ul>}
    </section>
  );
}
