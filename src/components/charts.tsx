import type { ReactNode } from "react";

/** Small, dependency-free SVG charts. Colour is never the only signal: every slice and bar has a label and a number beside it. */
export const CHART = { green: "#18181b", teal: "#14a06f", ink: "#09090b", amber: "#d99a06", blue: "#6b7a99", lilac: "#8b8b95", rose: "#dc4c3e", grey: "#d4d4d8" } as const;

export type Slice = { label: string; value: number; color: string };

export function Donut({ slices, size = 150, thickness = 22, centre }: { slices: Slice[]; size?: number; thickness?: number; centre?: ReactNode }) {
  const total = slices.reduce((n, s) => n + s.value, 0);
  const r = (size - thickness) / 2, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={slices.map((s) => `${s.label} ${s.value}`).join(", ")}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ececef" strokeWidth={thickness} />
          {total > 0 && slices.filter((s) => s.value > 0).map((s) => { const len = (s.value / total) * c; const el = <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness} strokeDasharray={`${Math.max(len - 2, 0)} ${c - Math.max(len - 2, 0)}`} strokeDashoffset={-acc} transform={`rotate(-90 ${size / 2} ${size / 2})`} />; acc += len; return el; })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">{centre}</div>
      </div>
      <ul className="min-w-[8rem] flex-1 space-y-1.5 text-[14px]">
        {slices.map((s) => <li key={s.label} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><span className="size-3 rounded-[4px]" style={{ background: s.color }} aria-hidden />{s.label}</span><span className="font-bold tabular-nums">{s.value}</span></li>)}
      </ul>
    </div>
  );
}

/** A circle that fills to a percentage. */
export function Ring({ value, color = CHART.green, size = 96, thickness = 12, label, sub }: { value: number; color?: string; size?: number; thickness?: number; label: ReactNode; sub?: string }) {
  const v = Math.max(0, Math.min(1, value));
  const r = (size - thickness) / 2, c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(v * 100)} percent`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ececef" strokeWidth={thickness} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round" strokeDasharray={`${v * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </svg>
        <div className="absolute inset-0 grid place-items-center font-[family-name:var(--font-display)] font-bold" style={{ fontSize: Math.max(11, size * 0.22) }}>{Math.round(v * 100)}%</div>
      </div>
      {(label || sub) && <div><p className="font-bold leading-tight">{label}</p>{sub && <p className="text-[13px] text-ink/65">{sub}</p>}</div>}
    </div>
  );
}

export function Bars({ data, color = CHART.green, height = 120, format = (n: number) => String(n) }: { data: { label: string; value: number }[]; color?: string; height?: number; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div role="img" aria-label={data.map((d) => `${d.label} ${format(d.value)}`).join(", ")}>
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((d) => (
          <div key={d.label} className="flex h-full flex-1 flex-col justify-end">
            <p className="mb-1 text-center text-[11.5px] font-bold tabular-nums text-ink/80">{d.value ? format(d.value) : ""}</p>
            <div className="w-full rounded-t-md" style={{ height: `${Math.max((d.value / max) * 100, d.value ? 6 : 2)}%`, background: d.value ? color : "#e4e4e7" }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">{data.map((d) => <p key={d.label} className="flex-1 text-center text-[12px] text-ink/65">{d.label}</p>)}</div>
    </div>
  );
}

/** A horizontal progress bar with the number it shows. */
export function Meter({ value, max, color = CHART.green, label }: { value: number; max: number; color?: string; label: string }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return <div><div className="mb-1 flex justify-between text-[13.5px]"><span>{label}</span><span className="font-bold tabular-nums">{value}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-[#ececef]"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div></div>;
}
