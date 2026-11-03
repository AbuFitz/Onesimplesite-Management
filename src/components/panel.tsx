import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

const TONES = { neutral: "bg-[#f4f4f5]", green: "bg-[#f4f4f5]", amber: "bg-[#f4f4f5]", blue: "bg-[#f4f4f5]", lilac: "bg-[#f4f4f5]", rose: "bg-[#f4f4f5]" } as const;
const DOT = { neutral: "#a1a1aa", green: "#16a34a", amber: "#d99a06", blue: "#2450d6", lilac: "#7c6ee6", rose: "#dc4c3e" } as const;
export type Tone = keyof typeof TONES;

/** A clearly bounded section: its own white card, a visible border, and a heading with a coloured icon. */
export function Panel({ title, icon: Icon, tone = "neutral", action, children, className = "" }: { title: string; icon?: LucideIcon; tone?: Tone; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-xl border border-[var(--card-line)] bg-white ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-[var(--card-rule)] bg-[var(--card-head)] px-4 py-2.5">
        <h2 className="flex items-center gap-2.5 text-[14px] font-bold leading-none text-ink">{Icon && <span className={`grid size-7 place-items-center rounded-md ${TONES[tone]}`}><Icon size={15} aria-hidden /></span>}{title}</h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** One big fact: a number, date or state that deserves to be seen first. */
export function SummaryTile({ label, value, sub, tone = "neutral" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone }) {
  return (
    <div className="rounded-xl border border-[var(--card-line)] bg-white px-4 py-3">
      <p className="flex items-center gap-2 text-[12.5px] font-semibold text-ink/65"><span className="size-2 rounded-full" style={{ background: DOT[tone] }} aria-hidden />{label}</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-[26px] font-bold leading-tight tracking-tight text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-[12.5px] text-ink/65">{sub}</p>}
    </div>
  );
}

/** A label and its value on one line, with a rule between rows. */
export function FactRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-start justify-between gap-4 border-b border-[var(--card-rule)] py-2.5 text-[15px] last:border-0"><dt className="shrink-0 text-ink/65">{label}</dt><dd className="min-w-0 text-right font-medium text-ink">{children}</dd></div>;
}
