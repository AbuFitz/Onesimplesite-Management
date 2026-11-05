import { greeting as hello } from "@/lib/greeting";
import Link from "next/link";
import { Plus, Ticket, PenLine, CreditCard, Repeat, CalendarDays, CheckSquare, FolderKanban, Trophy, Building2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { lastExport, isBackupDue } from "@/modules/export/service";
import { todayData } from "@/modules/today/service";
import { STATUS_LABEL } from "@/modules/support/options";
import { Donut, Ring, Bars, Meter, CHART } from "@/components/charts";
import { Panel, SummaryTile } from "@/components/panel";
import { LiveRefresh } from "@/components/live-refresh";
import { Empty, Status, money, fmtDateTime, fmtDate, timeAgo } from "@/components/ui";

export const metadata = { title: "Today" };
const gbp = (minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(minor / 100);

export default async function Today() {
  const ctx = await requireStaff();
  const w = ctx.workspaceId;
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 864e5);
  const seeBusiness = can(ctx.role, "customer.read");
  const mineOnly = can(ctx.role, "project.read_all") ? {} : { ownerId: ctx.staffId };
  const backupDue = can(ctx.role, "data.export") && isBackupDue(await lastExport(w));
  const [d, tasks, events, signed, myProjects] = await Promise.all([
    todayData(w, { staffId: ctx.staffId, seeBusiness }),
    db.task.findMany({ where: { workspaceId: w, assigneeId: ctx.staffId, doneAt: null }, orderBy: { dueDate: "asc" }, take: 6 }),
    db.calendarEvent.findMany({ where: { workspaceId: w, status: "scheduled", startsAt: { gte: startOfDay, lt: endOfDay }, OR: [{ organiserId: ctx.staffId }, { attendees: { some: { staffId: ctx.staffId } } }] }, orderBy: { startsAt: "asc" } }),
    seeBusiness ? db.contract.findMany({ where: { workspaceId: w, status: "completed", cancelledAt: null, completedAt: { gte: new Date(Date.now() - 14 * 864e5) } }, orderBy: { completedAt: "desc" }, take: 4, include: { customer: true } }) : [],
    db.project.findMany({ where: { workspaceId: w, stage: { notIn: ["completed", "cancelled", "launched"] }, ...mineOnly }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, name: true, stage: true, dueDate: true, customer: { select: { displayName: true } } } }),
  ]);
  const greeting = hello();
  const STEP = { planned: 0.1, awaiting_assets: 0.2, design: 0.4, development: 0.6, qa: 0.75, client_review: 0.85, ready_to_launch: 0.95 } as Record<string, number>;
  const quick = [["/tickets/new", "New ticket", Ticket], ["/customers/new", "Add a company", Building2], ["/calendar/new", "Add an event", CalendarDays]] as const;

  return (
    <>
      <LiveRefresh seconds={30} />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-[2rem]">{greeting}, {ctx.name.split(" ")[0]}</h1><p className="mt-1 text-ink/70">{new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "Europe/London" }).format(new Date())}</p></div>
        <div className="flex flex-wrap gap-2">{quick.map(([h, l, Icon]) => <Link key={h} href={h} className="btn btn-quiet"><Icon size={16} aria-hidden /> {l}</Link>)}</div>
      </header>
      {backupDue && <p className="mb-5 rounded-xl border border-[#f1d58a] bg-[#fff6dc] px-4 py-3 text-sm text-[#5c3b00]"><strong>Weekly backup due.</strong> <Link className="underline" href="/backup">Download a backup</Link></p>}

      {d && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Link href="/tickets" aria-label="Needs us: open the tickets" className="block rounded-2xl outline-offset-2 transition hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(14,19,17,.10)] focus-visible:outline focus-visible:outline-2"><SummaryTile tone="blue" label="Needs us" value={d.tickets.open} sub={d.tickets.replied ? `${d.tickets.replied} customer ${d.tickets.replied === 1 ? "reply" : "replies"}` : "tickets open"} /></Link>
            <Link href="/agreements?show=awaiting" aria-label="Waiting to sign: open the agreements" className="block rounded-2xl outline-offset-2 transition hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(14,19,17,.10)] focus-visible:outline focus-visible:outline-2"><SummaryTile tone="amber" label="Waiting to sign" value={d.awaiting} sub={`${d.tickets.waiting} waiting on customers`} /></Link>
            <Link href={d.money.pastDue && !d.money.dueCount ? "/payments?show=failed" : "/payments?show=due"} aria-label="To collect: see which payments" className="block rounded-2xl outline-offset-2 transition hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(14,19,17,.10)] focus-visible:outline focus-visible:outline-2"><SummaryTile tone="rose" label="To collect" value={gbp(d.money.dueMinor)} sub={d.money.pastDue ? `${d.money.pastDue} payment${d.money.pastDue === 1 ? "" : "s"} failed` : `${d.money.dueCount} unpaid`} /></Link>
            <Link href="/payments?show=plans" aria-label="Monthly plans: see which plans" className="block rounded-2xl outline-offset-2 transition hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(14,19,17,.10)] focus-visible:outline focus-visible:outline-2"><SummaryTile tone="lilac" label="Monthly plans" value={gbp(d.money.monthlyMinor)} sub={`${d.money.plans} active ${d.money.plans === 1 ? "plan" : "plans"}`} /></Link>
          </div>

          <div className="mb-5 grid gap-5 lg:grid-cols-3">
            <Panel title="Tickets right now" icon={Ticket} tone="blue" className="lg:col-span-1" action={<Link className="text-sm font-semibold text-moss" href="/tickets?tab=all">See them</Link>}>
              <Donut slices={[{ label: "Needs us", value: d.tickets.open, color: CHART.green }, { label: "Waiting on customer", value: d.tickets.waiting, color: CHART.amber }, { label: "Done", value: d.tickets.done, color: CHART.teal }]} centre={<div><p className="font-[family-name:var(--font-display)] text-3xl font-bold leading-none">{d.tickets.open + d.tickets.waiting}</p><p className="text-xs text-ink/65">open</p></div>} />
            </Panel>
            <Panel title="New tickets, last 7 days" icon={Ticket} tone="lilac" action={<Link className="text-sm font-semibold text-moss" href="/tickets?tab=all">See them</Link>}><Bars data={d.week} color={CHART.lilac} /></Panel>
            <Panel title="Money in, last 6 months" icon={CreditCard} tone="green" action={<Link className="text-sm font-semibold text-moss" href="/payments?show=paid">See payments</Link>}><Bars data={d.months} color={CHART.teal} format={(n) => `£${n}`} /></Panel>
          </div>

          <div className="mb-5 grid gap-5 lg:grid-cols-3">
            <Panel title="How we're doing" icon={Trophy} tone="amber" action={<Link className="text-sm font-semibold text-moss" href="/projects">Projects</Link>}>
              <div className="space-y-5">
                <Ring value={d.replyHealth} color={d.replyHealth > 0.8 ? CHART.teal : d.replyHealth > 0.5 ? CHART.amber : CHART.rose} label="Replied in time" sub="of tickets waiting on us" />
                <Ring value={d.projects.total ? d.projects.live / d.projects.total : 0} color={CHART.green} label="Sites live" sub={`${d.projects.live} of ${d.projects.total} projects`} />
              </div>
            </Panel>
            <Panel title="Sales pipeline" icon={PenLine} tone="rose" action={<Link className="text-sm font-semibold text-moss" href="/agreements">All agreements</Link>}>
              <div className="space-y-3.5">
                {([["new", "New enquiries", CHART.blue], ["qualified", "Quote in progress", CHART.lilac], ["proposal_sent", "Quote sent", CHART.amber], ["contract_pending", "Waiting to sign", CHART.rose], ["won", "Signed", CHART.teal]] as const).map(([k, l, c]) => <Link key={k} href={`/agreements?show=${({ new: "draft", qualified: "draft", proposal_sent: "awaiting", contract_pending: "awaiting", won: "signed" } as Record<string, string>)[k]}`} aria-label={`${l}: see them`} className="block rounded-lg px-1 -mx-1 hover:bg-bone/70"><Meter label={l} value={d.pipeline[k] ?? 0} max={Math.max(1, ...Object.values(d.pipeline))} color={c} /></Link>)}
              </div>
            </Panel>
            <Panel title="Needs your reply" icon={Repeat} tone="blue" action={<Link className="text-sm font-semibold text-moss" href="/tickets">All tickets</Link>}>
              {d.needsReply.length === 0 ? <Empty title="You're all caught up" /> : (
                <ul className="-my-1 divide-y divide-[var(--card-rule)]">{d.needsReply.slice(0, 5).map((t) => (
                  <li key={t.id}><Link href={`/support/${t.id}`} className="block py-2.5 hover:text-moss"><span className="flex items-start justify-between gap-2"><span className="min-w-0 truncate font-semibold">{t.title}</span><Status label={(STATUS_LABEL[t.status] ?? { label: t.status }).label} kind={t.status === "customer_replied" ? "warn" : "neutral"} /></span><span className="text-[13px] text-ink/65">{t.customer.displayName} · waiting {timeAgo(t.lastCustomerAt ?? t.createdAt).replace(" ago", "")}</span></Link></li>
                ))}</ul>
              )}
            </Panel>
          </div>
        </>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Today's agenda" icon={CalendarDays} tone="lilac" action={<Link className="text-sm font-semibold text-moss" href="/calendar">Calendar</Link>}>
          {events.length === 0 ? <Empty title="Nothing scheduled today"><Link className="underline" href="/calendar/new">Add an event</Link></Empty> : <ul className="divide-y divide-[var(--card-rule)]">{events.slice(0, 6).map((e) => <li key={e.id}><Link href="/calendar" className="flex items-center justify-between gap-3 py-2.5"><span className="font-semibold">{e.title}</span><span className="shrink-0 text-sm text-ink/70">{new Intl.DateTimeFormat("en-GB", { timeStyle: "short", timeZone: "Europe/London" }).format(e.startsAt)}</span></Link></li>)}{events.length > 6 && <li className="py-2.5 text-sm"><Link className="font-semibold text-moss" href="/calendar">+{events.length - 6} more today</Link></li>}</ul>}
        </Panel>
        <Panel title="My tasks" icon={CheckSquare} tone="green">
          {tasks.length === 0 ? <Empty title="You're all caught up" /> : <ul className="divide-y divide-[var(--card-rule)]">{tasks.map((t) => <li key={t.id} className="flex justify-between gap-3 py-2.5"><span>{t.title}</span><span className="shrink-0 text-sm text-ink/70">{fmtDate(t.dueDate)}</span></li>)}</ul>}
        </Panel>
        <Panel title="Projects in motion" icon={FolderKanban} tone="amber" action={<Link className="text-sm font-semibold text-moss" href="/projects">All projects</Link>}>
          {myProjects.length === 0 ? <Empty title="No projects running" /> : <ul className="space-y-3.5">{myProjects.map((p) => (
            <li key={p.id}><Link href={`/projects/${p.id}`} className="block"><span className="flex justify-between gap-2 text-[15px]"><span className="min-w-0 truncate font-semibold">{p.name}</span><span className="shrink-0 text-ink/65">{p.stage.replaceAll("_", " ")}</span></span><span className="mt-1.5 block h-2.5 overflow-hidden rounded-full bg-[#e3e8f2]"><span className="block h-full rounded-full" style={{ width: `${Math.round((STEP[p.stage] ?? 0.1) * 100)}%`, background: CHART.green }} /></span><span className="text-[13px] text-ink/65">{p.customer.displayName}{p.dueDate ? ` · due ${fmtDate(p.dueDate)}` : ""}</span></Link></li>
          ))}</ul>}
        </Panel>
        {signed.length > 0 && (
          <Panel title="Recently signed" icon={PenLine} tone="green">
            <ul className="divide-y divide-[var(--card-rule)]">{signed.map((c) => <li key={c.id}><Link href={`/contracts/${c.id}`} className="flex items-center justify-between gap-3 py-2.5"><span className="min-w-0"><span className="block truncate font-semibold">{c.title}</span><span className="text-[13px] text-ink/65">{c.customer.displayName}</span></span><span className="shrink-0 text-sm text-ink/70">{c.completedAt && fmtDateTime(c.completedAt)}</span></Link></li>)}</ul>
          </Panel>
        )}
      </div>
    </>
  );
}
