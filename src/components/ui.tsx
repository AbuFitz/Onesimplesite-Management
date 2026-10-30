import Link from "next/link";
import type { ReactNode } from "react";

const kinds = { good: "pill-good", warn: "pill-warn", bad: "pill-bad", neutral: "pill-neutral" } as const;
/** Status is always a labelled pill with a dot, never colour alone. */
export function Status({ label, kind = "neutral" }: { label: string; kind?: keyof typeof kinds }) {
  return <span className={`pill ${kinds[kind]}`}>{label.replaceAll("_", " ")}</span>;
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  return <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full bg-soft font-semibold text-ink" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials || "?"}</span>;
}

export function RecordHeader({ back, title, status, meta, action, avatar }: { back?: { href: string; label: string }; title: string; status?: ReactNode; meta?: ReactNode; action?: ReactNode; avatar?: boolean }) {
  return (
    <header className="mb-6 sm:mb-8">
      {back && <Link href={back.href} className="mb-1 inline-flex min-h-9 items-center gap-1 text-sm text-muted hover:text-ink">‹ {back.label}</Link>}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          {avatar && <Avatar name={title} size={44} />}
          <div className="min-w-0">
            <h1 className="break-words">{title}</h1>
            {(status || meta) && <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">{status}{meta}</div>}
          </div>
        </div>
        {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
      </div>
    </header>
  );
}

export function Stat({ label, value, href, hint }: { label: string; value: ReactNode; href?: string; hint?: string }) {
  const body = (<><p className="text-[13px] text-muted">{label}</p><p className="mt-0.5 text-[28px] font-semibold leading-none tracking-tight tabular-nums">{value}</p>{hint && <p className="mt-1 text-xs text-muted">{hint}</p>}</>);
  return href ? <Link href={href} className="block rounded-lg py-2 hover:bg-soft sm:-mx-3 sm:px-3">{body}</Link> : <div className="py-2">{body}</div>;
}

export function Tabs({ tabs, current }: { tabs: { id: string; label: string; href: string; count?: number }[]; current: string }) {
  return (
    <nav aria-label="Sections" className="scroll-x -mx-4 mb-8 border-b border-line px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-6">
        {tabs.map((t) => (
          <li key={t.id}>
            <Link href={t.href} aria-current={t.id === current ? "page" : undefined} className={`inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap border-b-2 text-sm ${t.id === current ? "border-ink font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`}>
              {t.label}{t.count ? <span className="text-xs text-muted">{t.count}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function ErrorSummary({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" tabIndex={-1} className="mb-5 rounded-lg bg-[#fdecea] px-4 py-3 text-sm text-[#7d1f16]"><strong className="font-semibold">Couldn't save.</strong> {message}</p>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="py-14 text-center"><p className="font-semibold">{title}</p>{children && <div className="mt-1 text-sm text-muted">{children}</div>}</div>;
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-10">
      <div className="mb-2 flex items-center justify-between gap-3"><h2>{title}</h2>{action}</div>
      {children}
    </section>
  );
}

export const money = (minor: number, currency = "GBP") => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
export const fmtDate = (d: Date | null | undefined) => (d ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" }).format(d) : "—");
export const fmtDateTime = (d: Date) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(d);
export const timeAgo = (d: Date) => {
  const s = Math.max(1, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 60) return "just now"; if (s < 3600) return `${Math.floor(s / 60)} min ago`; if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return fmtDate(d);
};
