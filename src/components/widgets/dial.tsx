import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

/** A radial dial gauge: tick marks, a hatched dial face, a filled wedge from 12 o'clock for the share, and a big light percentage above. Text carries the meaning; colour only accents it. */
export function Dial({ value, label, count, accent = "#ebd98a", size = 112 }: { value: number; label: string; count: number | string; accent?: string; size?: number }) {
  const v = Math.max(0, Math.min(1, value)), pct = Math.round(v * 100), c = 50, r = 33;
  const end = -Math.PI / 2 + v * 2 * Math.PI, x = c + r * Math.cos(end), y = c + r * Math.sin(end);
  const wedge = v >= 0.999 ? `M ${c} ${c - r} A ${r} ${r} 0 1 1 ${c - 0.01} ${c - r} Z` : v <= 0 ? "" : `M ${c} ${c} L ${c} ${c - r} A ${r} ${r} 0 ${v > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
  const id = `h${label.replace(/\W/g, "")}`;
  return (
    <div className="dial" role="img" aria-label={`${label}: ${count}, ${pct} percent`}>
      <b className="num">{pct}<small>%</small></b>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
        <defs><pattern id={id} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="3" fill="#1d231a" /><line x1="0" y1="0" x2="0" y2="3" stroke="#2e3629" strokeWidth="1.2" /></pattern></defs>
        {Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * 2 * Math.PI, long = i % 6 === 0; return <line key={i} x1={c + 41 * Math.cos(a)} y1={c + 41 * Math.sin(a)} x2={c + (long ? 47 : 44.5) * Math.cos(a)} y2={c + (long ? 47 : 44.5) * Math.sin(a)} stroke="rgba(255,255,255,.35)" strokeWidth={long ? 1.3 : .8} strokeLinecap="round" />; })}
        <circle cx={c} cy={c} r={r} fill={`url(#${id})`} stroke="rgba(255,255,255,.08)" />
        {wedge && <path d={wedge} fill={accent} />}
        <line x1={c} y1={c} x2={x} y2={y} stroke="#fff" strokeWidth="1" opacity=".9" /><circle cx={c} cy={c} r="2.4" fill="#fff" />
      </svg>
      <span>{label} <em>({count})</em></span>
    </div>
  );
}

/** The dark floating status panel: a title with an icon, an arrow that opens the full list, and dial tiles. */
export function DialPanel({ title, icon: Icon, href, children }: { title: string; icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>; href: string; children: ReactNode }) {
  return (
    <section className="dpanel" aria-label={title}>
      <header><span className="dp-chip"><Icon size={17} aria-hidden /></span><h2>{title}</h2><Link href={href} className="dp-go" aria-label={`Open ${title}`}><ArrowUpRight size={18} aria-hidden /></Link></header>
      <div className="dp-grid">{children}</div>
    </section>
  );
}
