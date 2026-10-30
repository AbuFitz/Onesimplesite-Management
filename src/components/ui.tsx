import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Clock, CircleDot } from "lucide-react";

const tone: Record<string, { cls: string; Icon: typeof Clock }> = {
  good: { cls: "text-moss", Icon: CheckCircle2 },
  warn: { cls: "text-warn", Icon: Clock },
  bad: { cls: "text-danger", Icon: AlertTriangle },
  neutral: { cls: "text-muted", Icon: CircleDot },
};
/** Status always carries a text label and icon, never colour alone. */
export function Status({ label, kind = "neutral" }: { label: string; kind?: keyof typeof tone }) {
  const { cls, Icon } = tone[kind];
  return <span className={`inline-flex items-center gap-1 text-xs font-semibold ${cls}`}><Icon size={14} aria-hidden />{label.replaceAll("_", " ")}</span>;
}

export function RecordHeader({ back, title, status, meta, action }: { back?: { href: string; label: string }; title: string; status?: ReactNode; meta?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-6">
      {back && <Link href={back.href} className="text-sm text-muted hover:underline inline-flex min-h-11 items-center">← {back.label}</Link>}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words">{title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">{status}{meta}</div>
        </div>
        {action}
      </div>
    </header>
  );
}

export function ErrorSummary({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" tabIndex={-1} className="mb-4 border-l-4 border-danger bg-wash px-3 py-2 text-sm"><strong>Could not save.</strong> {message}</p>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="py-10 text-center"><p className="font-semibold">{title}</p><div className="mt-1 text-sm text-muted">{children}</div></div>;
}

export const money = (minor: number, currency = "GBP") => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
export const fmtDate = (d: Date | null | undefined) => (d ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" }).format(d) : "—");
export const fmtDateTime = (d: Date) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(d);
