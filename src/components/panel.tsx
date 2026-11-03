import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

const TONES = { neutral: "bg-[#ebe9e1]", green: "bg-[#d7f3e6]", amber: "bg-[#f8ecbf]", blue: "bg-[#dcebf9]", lilac: "bg-[#e5e0f8]", rose: "bg-[#fbdccf]" } as const;
export type Tone = keyof typeof TONES;

/** A clearly bounded section: its own white card, a visible border, and a heading with a coloured icon. */
export function Panel({ title, icon: Icon, tone = "neutral", action, children, className = "" }: { title: string; icon?: LucideIcon; tone?: Tone; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-[#cfd5d0] bg-white shadow-[0_1px_2px_rgba(14,19,17,.06)] ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-[#e3e7e3] bg-[#fafaf8] px-4 py-3">
        <h2 className="flex items-center gap-2.5 text-[15px] font-bold leading-none text-ink">{Icon && <span className={`grid size-7 place-items-center rounded-lg ${TONES[tone]}`}><Icon size={16} aria-hidden /></span>}{title}</h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** One big fact: a number, date or state that deserves to be seen first. */
export function SummaryTile({ label, value, sub, tone = "neutral" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone }) {
  return (
    <div className={`rounded-2xl border border-black/5 px-4 py-3 ${TONES[tone]}`}>
      <p className="text-[13px] font-semibold text-ink/70">{label}</p>
      <p className="mt-0.5 font-[family-name:var(--font-display)] text-2xl font-bold leading-tight text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-[13px] text-ink/70">{sub}</p>}
    </div>
  );
}

/** A label and its value on one line, with a rule between rows. */
export function FactRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-start justify-between gap-4 border-b border-[#eceeec] py-2.5 text-[15px] last:border-0"><dt className="shrink-0 text-ink/65">{label}</dt><dd className="min-w-0 text-right font-medium text-ink">{children}</dd></div>;
}
