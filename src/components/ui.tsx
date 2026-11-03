import Link from "next/link";
import type { ReactNode } from "react";

const kinds = { good: "pill-good", warn: "pill-warn", bad: "pill-bad", neutral: "pill-neutral" } as const;
/** Status is always a labelled pill with a dot, never colour alone. */
/**
 * One vocabulary for every status in the system, in plain words. Raw values from the database
 * (awaiting_signature, ready_to_launch...) are translated here, so no page shows machine words.
 */
export const STATUS_WORDS: Record<string, { label: string; kind: keyof typeof kinds }> = {
  // quotes and agreements
  draft: { label: "Draft", kind: "warn" }, sent: { label: "Sent", kind: "neutral" }, accepted: { label: "Signed", kind: "good" },
  awaiting_signature: { label: "Waiting to sign", kind: "warn" }, completed: { label: "Signed", kind: "good" }, declined: { label: "Declined", kind: "bad" },
  expired: { label: "Expired", kind: "bad" }, voided: { label: "Withdrawn", kind: "neutral" }, withdrawn: { label: "Withdrawn", kind: "neutral" },
  // projects
  planned: { label: "Planned", kind: "neutral" }, awaiting_assets: { label: "Waiting on the client", kind: "warn" }, design: { label: "Design", kind: "neutral" },
  development: { label: "Building", kind: "neutral" }, qa: { label: "Testing", kind: "neutral" }, client_review: { label: "With the client to review", kind: "warn" },
  ready_to_launch: { label: "Ready to launch", kind: "good" }, launched: { label: "Live", kind: "good" }, held: { label: "On hold", kind: "warn" }, cancelled: { label: "Cancelled", kind: "bad" },
  // support tickets
  open: { label: "Open", kind: "warn" }, in_progress: { label: "In progress", kind: "neutral" }, waiting_customer: { label: "Waiting on the customer", kind: "warn" },
  resolved: { label: "Resolved", kind: "good" }, closed: { label: "Closed", kind: "neutral" },
  // generic
  published: { label: "Live", kind: "good" }, retired: { label: "Replaced", kind: "neutral" }, pending: { label: "Invited", kind: "warn" }, active: { label: "Active", kind: "good" }, deactivated: { label: "Deactivated", kind: "bad" },
};

export function Status({ label, kind }: { label: string; kind?: keyof typeof kinds }) {
  const known = STATUS_WORDS[label];
  const text = known ? known.label : label.replaceAll("_", " ");
  const k = kind ?? known?.kind ?? "neutral";
  return <span className={`pill ${kinds[k]}`}>{text}</span>;
}

/** Initials, with the person's picture on top when they have one (team members only). A missing picture just leaves the initials. */
export function Avatar({ name, size = 36, staffId, base = "/api/avatar" }: { name: string; size?: number; staffId?: string | null; base?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  return (
    <span aria-hidden className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-soft font-semibold text-ink" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials || "?"}
      {staffId && <span className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${base}/${staffId})` }} />}
    </span>
  );
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
  const body = (<><p className="text-[13px] font-semibold text-ink/70">{label}</p><p className="mt-1 text-[26px] font-bold leading-none tracking-tight tabular-nums">{value}</p>{hint && <p className="mt-1 text-xs text-ink/60">{hint}</p>}</>);
  const box = "block rounded-2xl border border-black/5 bg-[#f1f0eb] px-4 py-3";
  return href ? <Link href={href} className={`${box} hover:bg-[#e9e8e1]`}>{body}</Link> : <div className={box}>{body}</div>;
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
    <section className="mb-5 overflow-hidden rounded-2xl border border-[#cfd5d0] bg-white shadow-[0_1px_2px_rgba(14,19,17,.06)]">
      <header className="flex items-center justify-between gap-3 border-b border-[#e3e7e3] bg-[#fafaf8] px-4 py-3"><h2 className="text-[15px] font-bold leading-none">{title}</h2>{action}</header>
      <div className="p-4">{children}</div>
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
