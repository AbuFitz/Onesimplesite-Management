import Link from "next/link";
import { ArrowRight, FileText, LifeBuoy, ListChecks } from "lucide-react";
import { clientCanAny } from "@/modules/portal/access";
import { requireClient } from "@/modules/identity/session";
import { clientOverview, STAGE_COPY } from "@/modules/portal/service";
import { clientTickets } from "@/modules/support/service";
import { greeting, todayLabel } from "@/lib/greeting";
import { fmtDate, timeAgo } from "@/components/ui";

export const metadata = { title: "Home" };

const STEPS = ["Planning", "Design", "Build", "Review", "Live"] as const;
const stepOf = (stage: string) => ({ planned: 0, awaiting_assets: 0, design: 1, development: 2, qa: 2, client_review: 3, ready_to_launch: 3, launched: 4, completed: 4 } as Record<string, number>)[stage] ?? 0;

export default async function PortalOverview() {
  const c = await requireClient();
  const [o, tickets] = await Promise.all([clientOverview(c), clientTickets(c)]);
  const first = (c.name ?? "").split(" ")[0] || "there";
  const current = o.projects.find((p) => !["completed", "cancelled"].includes(p.stage));
  const mine = current ? o.assets.filter((x) => x.projectId === current.id) : o.assets;
  const open = tickets.filter((t) => !["resolved", "closed"].includes(t.status)); // every ticket in the company that is still live, whoever raised it
  const needsYou = tickets.filter((t) => t.status === "waiting_customer");
  const step = current ? stepOf(current.stage) : 0;

  return (
    <div className="space-y-4">
      <section className="tile relative overflow-hidden bg-spring !p-7 sm:!p-10" aria-labelledby="hi">
        <div className="absolute -right-10 -top-10 size-48 rounded-full bg-white/30" aria-hidden /><div className="absolute -bottom-16 right-16 size-40 rounded-full bg-ink/10" aria-hidden />
        <p className="relative mb-2 text-sm font-semibold opacity-70">{todayLabel()}</p>
        <h1 id="hi" className="relative text-[2.4rem] leading-none sm:text-6xl">{greeting()}, {first}</h1>
        <p className="relative mt-3 max-w-xl text-lg font-medium sm:text-xl">{needsYou.length ? `We replied on ${needsYou.length === 1 ? "a ticket" : `${needsYou.length} tickets`}. Have a look when you can.` : current ? STAGE_COPY[current.stage] : "Everything is up to date. Nice."}</p>
        <div className="relative mt-6 flex flex-wrap gap-3">{clientCanAny(c, "tickets") && <Link href="/help/new" className="btn btn-dark">Raise a ticket</Link>}<Link href="/documents" className="btn btn-quiet">Your documents</Link></div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="tile tile-mint md:col-span-2" aria-labelledby="pj">
          <div className="flex items-start justify-between gap-3"><h2 id="pj" className="text-xl">{current ? current.name : "Your project"}</h2>{current && <Link href={`/projects/${current.id}`} className="inline-flex items-center gap-1 text-sm font-bold">Details <ArrowRight size={15} aria-hidden /></Link>}</div>
          {current ? (
            <>
              <ol className="mt-5 grid grid-cols-5 gap-1.5" aria-label="Progress">{STEPS.map((s, i) => <li key={s} aria-current={i === step ? "step" : undefined}><div className={`h-2.5 rounded-full ${i <= step ? "bg-ink" : "bg-white/70"}`} /><p className={`mt-1.5 text-xs sm:text-sm ${i === step ? "font-bold" : "text-ink/60"}`}>{s}</p></li>)}</ol>
              <p className="mt-6 max-w-md rounded-xl bg-white/70 px-4 py-3 text-[15px]"><span className="block text-xs font-bold uppercase tracking-wide text-muted">Right now</span>{STAGE_COPY[current.stage] ?? "We're working on it."}</p>
              {current.dueDate && <p className="mt-3 text-sm">Aiming for <strong>{fmtDate(current.dueDate)}</strong></p>}
            </>
          ) : <p className="mt-3">Your project will show up here as soon as it starts.</p>}
        </section>
        <section className="tile tile-blush" aria-labelledby="tk">
          <LifeBuoy size={26} aria-hidden /><h2 id="tk" className="mt-3 text-xl">Get help</h2>
          <p className="mt-1 text-5xl font-bold font-[family-name:var(--font-display)]">{open.length}</p><p className="text-sm">open {open.length === 1 ? "ticket" : "tickets"}</p>
          {open.length > 0 && <ul className="mt-3 space-y-1.5">{open.slice(0, 3).map((t) => <li key={t.id}><Link href={`/help/${t.id}`} className="block truncate rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold hover:bg-white">{t.title}<span className="block text-xs font-normal text-muted">{t.contact ? `by ${t.contact.name}` : "by us"} · {timeAgo(t.updatedAt)}</span></Link></li>)}</ul>}
          <Link href="/help" className="mt-3 inline-flex items-center gap-1 text-sm font-bold">See tickets <ArrowRight size={15} aria-hidden /></Link>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="tile tile-butter" aria-labelledby="need">
          <ListChecks size={26} aria-hidden /><h2 id="need" className="mt-3 text-xl">What we need from you</h2>
          {mine.length === 0 ? <p className="mt-2">Nothing right now. We'll tell you when something comes up.</p> : (
            <ul className="mt-3 space-y-2">{mine.slice(0, 4).map((x) => <li key={x.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-2xl bg-white/70 px-4 py-2.5"><span className="font-semibold">{x.label}</span>{x.dueDate && <span className="text-sm">by {fmtDate(x.dueDate)}</span>}</li>)}</ul>
          )}
          {mine.length > 0 && <p className="mt-3 text-sm">Open your project to send them straight to us. Please never send passwords.</p>}
        </section>
        <section className="tile tile-lilac" aria-labelledby="docs">
          <FileText size={26} aria-hidden /><h2 id="docs" className="mt-3 text-xl">Your documents</h2>
          {o.documents.length === 0 ? <p className="mt-2">Signed copies of your agreements will appear here.</p> : (
            <ul className="mt-3 space-y-2">{o.documents.map((d) => <li key={d.id} className="rounded-2xl bg-white/70 px-4 py-2.5"><span className="font-semibold">{d.title}</span><span className="block text-sm">{d.reference}</span></li>)}</ul>
          )}
          <Link href="/documents" className="mt-3 inline-flex items-center gap-1 text-sm font-bold">All documents <ArrowRight size={15} aria-hidden /></Link>
        </section>
      </div>

      <section className="card p-6 sm:p-8" aria-labelledby="up">
        <h2 id="up" className="text-xl">Latest updates</h2>
        {o.updates.length === 0 ? <p className="mt-2 text-muted">No updates yet. We'll post progress here.</p> : (
          <ul className="mt-4 space-y-4">{o.updates.map((u) => <li key={u.id} className="flex gap-3"><span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-spring" aria-hidden /><div><p className="text-xs text-muted">{timeAgo(u.createdAt)}</p><p className="whitespace-pre-wrap">{u.body}</p></div></li>)}</ul>
        )}
      </section>
    </div>
  );
}
