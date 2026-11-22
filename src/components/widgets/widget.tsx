import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { Spark, Delta } from "./spark";
import { Drill, DrillTile } from "./drill";

/** The shared widget shell: a glass surface with an icon chip, a title, optional range tabs and action, and defined empty and error states. */
export function Widget({ title, icon: Icon, action, range, children, empty, error, foot, className = "", drill }: {
  title: string; icon?: ComponentType<{ size?: number; "aria-hidden"?: boolean }>; action?: ReactNode; range?: ReactNode;
  children?: ReactNode; empty?: { title: string; hint?: ReactNode } | null; error?: string | null; foot?: ReactNode; className?: string; drill?: { href: string; label?: string; detail: ReactNode };
}) {
  const body = (
    <section className={`wdg ${className}`} aria-label={title} data-drill={drill ? "" : undefined}>
      <header className="wdg-h">
        {Icon && <span className="wdg-chip"><Icon size={16} aria-hidden /></span>}
        <h2>{title}</h2>
        <div className="wdg-act">{action}</div>
      </header>
      <div className="wdg-b">
        {error ? <div className="wdg-state" role="alert"><b>Couldn&apos;t load this</b><span>{error}</span></div>
          : empty ? <div className="wdg-state"><b>{empty.title}</b>{empty.hint && <span>{empty.hint}</span>}</div>
          : <>{range && <div className="wdg-sub">{range}</div>}{children}</>}
      </div>
      {foot && <footer className="wdg-f">{foot}</footer>}
    </section>
  );
  return drill ? <Drill title={title} href={drill.href} linkLabel={drill.label} detail={drill.detail}>{body}</Drill> : body;
}

export function SeeAll({ href, children = "See all" }: { href: string; children?: ReactNode }) { return <Link className="wdg-link" href={href}>{children}</Link>; }

/** Day range tabs that drive the page through `?range=`. Server rendered, so the choice survives a refresh and can be shared. */
export function RangeTabs({ current, base = "" }: { current: number; base?: string }) {
  return (
    <nav className="wdg-range" aria-label="Time range">
      {[7, 30, 90].map((d) => <Link key={d} href={`${base}?range=${d}`} scroll={false} aria-current={current === d ? "true" : undefined}>{d}d</Link>)}
    </nav>
  );
}

/** A whole-tile link KPI: label, big number, change against the previous period (or a plain note), and an optional trend line. */
export function Kpi({ label, value, href, tone = "olive", delta, note, spark, sparkLabel, detail, linkLabel }: {
  label: string; value: ReactNode; href: string; tone?: "olive" | "amber" | "rose" | "violet" | "blue";
  delta?: { now: number; prev: number; goodWhen?: "up" | "down"; label?: ReactNode }; note?: ReactNode; spark?: number[]; sparkLabel?: string; detail?: ReactNode; linkLabel?: string;
}) {
  const colour = { olive: "#4a6024", amber: "#c9901a", rose: "#d9582b", violet: "#8f7bd1", blue: "#3f6bb0" }[tone];
  const inner = (
    <>
      <span className="kpi-l"><i style={{ background: colour }} />{label}</span>
      <span className="kpi-v num">{value}</span>
      <span className="kpi-m">{delta ? <Delta {...delta} /> : note}</span>
      {spark && spark.length > 1 && <Spark data={spark} color={colour} label={sparkLabel ?? label} height={36} />}
    </>
  );
  const name = `${label}: ${typeof value === "string" || typeof value === "number" ? value : ""}`;
  if (detail) return <DrillTile title={label} href={href} linkLabel={linkLabel} detail={detail} tone={tone} label={`${name}. Summary`}>{inner}</DrillTile>;
  return <Link href={href} className="wdg kpi" data-tone={tone} aria-label={`${name}. Open`}>{inner}</Link>;
}
