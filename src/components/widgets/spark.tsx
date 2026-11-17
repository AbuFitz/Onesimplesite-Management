import type { ReactNode } from "react";

/** Dependency-free SVG chart shapes for widgets: light, server-rendered, and never colour-only (every chart has a text summary). */
const pts = (data: number[], w: number, h: number, pad = 3) => {
  const max = Math.max(...data, 1), min = Math.min(...data, 0), span = max - min || 1;
  return data.map((v, i) => [data.length === 1 ? w / 2 : (i / (data.length - 1)) * w, h - pad - ((v - min) / span) * (h - pad * 2)] as const);
};
const line = (p: readonly (readonly [number, number])[]) => p.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

/** A small trend line with a soft area under it and a dot on the latest value. */
export function Spark({ data, color = "#111214", height = 44, label }: { data: number[]; color?: string; height?: number; label: string }) {
  const w = 120, p = pts(data.length ? data : [0], w, height), id = `sp${color.replace(/\W/g, "")}${data.length}`;
  const last = p[p.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${label}: ${data.length ? `${data[0]} to ${data[data.length - 1]}` : "no data"}`} style={{ height }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".28" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {p.length > 1 && <path d={`${line(p)} L${w} ${height} L0 ${height} Z`} fill={`url(#${id})`} />}
      <path d={line(p)} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill="#fff" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** A time series with a baseline, a peak marker and first/last labels, for the larger widgets. Hover or focus a bar to read it. */
export function Series({ data, color = "#111214", height = 150, format = (n: number) => String(n), kind = "bars" }: { data: { label: string; value: number }[]; color?: string; height?: number; format?: (n: number) => string; kind?: "bars" | "area" }) {
  const max = Math.max(...data.map((d) => d.value), 1), total = data.reduce((n, d) => n + d.value, 0), peak = data.reduce((b, d, i) => (d.value > data[b].value ? i : b), 0);
  if (kind === "area") {
    const w = 300, p = pts(data.map((d) => d.value), w, height - 22, 6);
    return (
      <figure className="series" style={{ height }}>
        <svg viewBox={`0 0 ${w} ${height - 22}`} preserveAspectRatio="none" role="img" aria-label={`Total ${format(total)}. ${data.map((d) => `${d.label} ${format(d.value)}`).join(", ")}`} style={{ height: height - 22 }}>
          <defs><linearGradient id="ser-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".3" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
          <path d={`${line(p)} L${w} ${height - 22} L0 ${height - 22} Z`} fill="url(#ser-a)" /><path d={line(p)} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <figcaption><span>{data[0]?.label}</span><span>{data[data.length - 1]?.label}</span></figcaption>
      </figure>
    );
  }
  return (
    <figure className="series" style={{ height }} aria-label={`Total ${format(total)}`}>
      <div className="bars" style={{ height: height - 24 }}>
        {data.map((d, i) => (
          <div key={d.label + i} className="bar" tabIndex={0} title={`${d.label}: ${format(d.value)}`} aria-label={`${d.label}: ${format(d.value)}`}>
            {i === peak && d.value > 0 && <span className="peak">{format(d.value)}</span>}
            <i style={{ height: `${Math.max(d.value ? 6 : 3, (d.value / max) * 100)}%`, background: d.value ? color : "rgba(14, 16, 22,.1)", opacity: i === peak ? 1 : .72 }} />
          </div>
        ))}
      </div>
      <figcaption>{data.map((d) => <span key={d.label}>{d.label}</span>)}</figcaption>
    </figure>
  );
}

/** Stacked horizontal funnel: each stage is a row with its own bar scaled to the biggest stage, a count, and a link. */
export function Funnel({ stages }: { stages: { label: string; value: number; color: string; href: string }[] }) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  return (
    <ul className="funnel">
      {stages.map((s) => (
        <li key={s.label}><a href={s.href} aria-label={`${s.label}: see them`}><span className="fl"><span>{s.label}</span><b className="num">{s.value}</b></span><span className="ft"><i style={{ width: `${s.value ? Math.max(4, (s.value / max) * 100) : 0}%`, background: s.color }} /></span></a></li>
      ))}
    </ul>
  );
}

/** "Up 12%" style change against the previous period. `goodWhen` says which direction is good, so a fall in unpaid money shows green. */
export function Delta({ now, prev, goodWhen = "up", label }: { now: number; prev: number; goodWhen?: "up" | "down"; label?: ReactNode }) {
  if (!prev && !now) return <span className="delta flat">No change{label ? <> · {label}</> : null}</span>;
  if (!prev) return <span className={`delta ${goodWhen === "up" ? "up" : "down"}`}>Up from none{label ? <> · {label}</> : null}</span>;
  const pct = Math.round(((now - prev) / prev) * 100);
  if (pct === 0) return <span className="delta flat">No change{label ? <> · {label}</> : null}</span>;
  const good = (pct > 0) === (goodWhen === "up");
  return <span className={`delta ${good ? "up" : "down"}`}><span aria-hidden>{pct > 0 ? "▲" : "▼"}</span> {Math.abs(pct)}%<span className="sr-only">{pct > 0 ? " up" : " down"}</span>{label ? <> · {label}</> : null}</span>;
}
