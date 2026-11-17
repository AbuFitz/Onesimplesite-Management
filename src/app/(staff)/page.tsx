import { greeting as hello } from "@/lib/greeting";
import Link from "next/link";
import { Plus, Ticket, PenLine, CreditCard, Repeat, CalendarDays, CheckSquare, FolderKanban, Trophy, Building2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { lastExport, isBackupDue } from "@/modules/export/service";
import { todayData, todayTrends } from "@/modules/today/service";
import { STATUS_LABEL } from "@/modules/support/options";
import { Donut, Ring, CHART } from "@/components/charts";
import { Widget, SeeAll, RangeTabs, Kpi } from "@/components/widgets/widget";
import { Series, Funnel, Delta } from "@/components/widgets/spark";
import { WidgetGrid, type GridWidget } from "@/components/widgets/grid";
import { Dial, DialPanel } from "@/components/widgets/dial";
import { LiveRefresh } from "@/components/live-refresh";
import { Status, fmtDateTime, fmtDate, timeAgo } from "@/components/ui";

export const metadata = { title: "Today" };
const gbp = (minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(minor / 100);

export default async function Today({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const days = ([7, 30, 90] as const).find((n) => String(sp.range) === String(n)) ?? 30;
  const w = ctx.workspaceId;
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 864e5);
  const seeBusiness = can(ctx.role, "customer.read");
  const mineOnly = can(ctx.role, "project.read_all") ? {} : { ownerId: ctx.staffId };
  const backupDue = can(ctx.role, "data.export") && isBackupDue(await lastExport(w));
  const [d, trends, tasks, events, signed, myProjects] = await Promise.all([
    todayData(w, { staffId: ctx.staffId, seeBusiness }),
    seeBusiness ? todayTrends(w, days) : null,
    db.task.findMany({ where: { workspaceId: w, assigneeId: ctx.staffId, doneAt: null }, orderBy: { dueDate: "asc" }, take: 6 }),
    db.calendarEvent.findMany({ where: { workspaceId: w, status: "scheduled", startsAt: { gte: startOfDay, lt: endOfDay }, OR: [{ organiserId: ctx.staffId }, { attendees: { some: { staffId: ctx.staffId } } }] }, orderBy: { startsAt: "asc" } }),
    seeBusiness ? db.contract.findMany({ where: { workspaceId: w, status: "completed", cancelledAt: null, completedAt: { gte: new Date(Date.now() - 14 * 864e5) } }, orderBy: { completedAt: "desc" }, take: 4, include: { customer: true } }) : [],
    db.project.findMany({ where: { workspaceId: w, stage: { notIn: ["completed", "cancelled", "launched"] }, ...mineOnly }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, name: true, stage: true, dueDate: true, customer: { select: { displayName: true } } } }),
  ]);
  const greeting = hello();
  const STEP = { planned: 0.1, awaiting_assets: 0.2, design: 0.4, development: 0.6, qa: 0.75, client_review: 0.85, ready_to_launch: 0.95 } as Record<string, number>;
  const quick = [["/tickets/new", "New ticket", Ticket], ["/customers/new", "Add a company", Building2], ["/calendar/new", "Add an event", CalendarDays]] as const;
  const range = <RangeTabs current={days} />;
  const per = `last ${days} days`;
  const gbpShort = (n: number) => `£${n.toLocaleString("en-GB")}`;
  const widgets: GridWidget[] = [];

  if (d && trends) {
    const t = trends;
    widgets.push(
      { id: "k-needs", title: "Needs us", size: "s", node: <Kpi label="Needs us" tone="blue" value={d.tickets.open} href="/tickets" note={d.tickets.replied ? `${d.tickets.replied} customer ${d.tickets.replied === 1 ? "reply" : "replies"}` : "All answered"} spark={t.tickets.series.map((p) => p.value)} sparkLabel={`Tickets per period, ${per}`} /> },
      { id: "k-sign", title: "Waiting to sign", size: "s", node: <Kpi label="Waiting to sign" tone="amber" value={d.awaiting} href="/agreements?show=awaiting" note={`${d.pipeline.contract_pending ?? 0} in the pipeline`} spark={t.signed.series.map((p) => p.value)} sparkLabel={`Agreements signed, ${per}`} /> },
      { id: "k-collect", title: "To collect", size: "s", node: <Kpi label="To collect" tone="rose" value={gbp(d.money.dueMinor)} href={d.money.pastDue && !d.money.dueCount ? "/payments?show=failed" : "/payments?show=due"} note={d.money.pastDue ? `${d.money.pastDue} failed · ${d.money.dueCount} due` : `${d.money.dueCount} unpaid`} /> },
      { id: "k-plans", title: "Monthly plans", size: "s", node: <Kpi label="Monthly plans" tone="violet" value={gbpShort(Math.round(d.money.monthlyMinor / 100))} href="/payments?show=plans" note={`${d.money.plans} active ${d.money.plans === 1 ? "plan" : "plans"}`} /> },
      { id: "w-status", title: "Ticket status", size: "m", node: (() => { const all = Math.max(1, d.tickets.open + d.tickets.waiting + d.tickets.done); return (
        <DialPanel title="Ticket status" icon={Ticket} href="/tickets?tab=all">
          <Dial value={d.tickets.open / all} label="Needs us" count={d.tickets.open} accent="#d6e8a7" />
          <Dial value={d.tickets.waiting / all} label="Waiting" count={d.tickets.waiting} accent="#a0b2c8" />
        </DialPanel>); })() },
      { id: "w-tickets", title: "Tickets right now", size: "m", node: (
        <Widget title="Tickets right now" icon={Ticket} action={<SeeAll href="/tickets?tab=all">See them</SeeAll>} empty={d.tickets.open + d.tickets.waiting + d.tickets.done === 0 ? { title: "No tickets yet", hint: "They appear here when a customer asks for help." } : null}>
          <Donut slices={[{ label: "Needs us", value: d.tickets.open, color: CHART.green }, { label: "Waiting on customer", value: d.tickets.waiting, color: CHART.amber }, { label: "Done", value: d.tickets.done, color: CHART.teal }]} centre={<div><p className="font-[family-name:var(--font-display)] text-3xl font-medium leading-none">{d.tickets.open + d.tickets.waiting}</p><p className="text-xs text-muted">open</p></div>} />
        </Widget>) },
      { id: "w-new-tickets", title: "New tickets", size: "m", node: (
        <Widget title="New tickets" icon={Ticket} range={range} action={<SeeAll href="/tickets?tab=all">See them</SeeAll>} empty={t.tickets.total === 0 && t.tickets.prev === 0 ? { title: `No new tickets in the ${per}`, hint: "Good news, or a quiet spell." } : null}>
          <p className="wdg-big"><span className="num">{t.tickets.total}</span><Delta now={t.tickets.total} prev={t.tickets.prev} goodWhen="down" label="vs the period before" /></p>
          <Series data={t.tickets.series} color={CHART.lilac} height={140} />
        </Widget>) },
      { id: "w-money", title: "Money in", size: "m", node: (
        <Widget title="Money in" icon={CreditCard} range={range} action={<SeeAll href="/payments?show=paid">Payments</SeeAll>} empty={t.money.total === 0 && t.money.prev === 0 ? { title: `No payments in the ${per}`, hint: "Receipts show here as money arrives." } : null}
          foot={<>Monthly plans running: <b className="num">{gbpShort(Math.round(d.money.monthlyMinor / 100))}</b> a month ({d.money.plans})</>}>
          <p className="wdg-big"><span className="num">{gbpShort(t.money.total)}</span><Delta now={t.money.total} prev={t.money.prev} label="vs the period before" /></p>
          <Series data={t.money.series} kind="area" color={CHART.teal} height={140} format={gbpShort} />
        </Widget>) },
      { id: "w-health", title: "How we're doing", size: "m", node: (
        <Widget title="How we're doing" icon={Trophy} action={<SeeAll href="/projects">Projects</SeeAll>}>
          <div className="space-y-5">
            <Ring value={d.replyHealth} color={d.replyHealth > 0.8 ? CHART.teal : d.replyHealth > 0.5 ? CHART.amber : CHART.rose} label="Replied in time" sub="of tickets waiting on us" />
            <Ring value={d.projects.total ? d.projects.live / d.projects.total : 0} color={CHART.green} label="Sites live" sub={`${d.projects.live} of ${d.projects.total} projects`} />
          </div>
        </Widget>) },
      { id: "w-pipeline", title: "Sales pipeline", size: "m", node: (
        <Widget title="Sales pipeline" icon={PenLine} action={<SeeAll href="/agreements">All agreements</SeeAll>} foot={<>New enquiries in the {per}: <b className="num">{t.enquiries.total}</b> <Delta now={t.enquiries.total} prev={t.enquiries.prev} /></>}>
          <Funnel stages={([["new", "New enquiries", CHART.blue, "draft"], ["qualified", "Quote in progress", CHART.lilac, "draft"], ["proposal_sent", "Quote sent", CHART.amber, "awaiting"], ["contract_pending", "Waiting to sign", CHART.rose, "awaiting"], ["won", "Signed", CHART.teal, "signed"]] as const).map(([k, label, color, show]) => ({ label, color, value: d.pipeline[k] ?? 0, href: `/agreements?show=${show}` }))} />
        </Widget>) },
      { id: "w-reply", title: "Needs your reply", size: "m", node: (
        <Widget title="Needs your reply" icon={Repeat} action={<SeeAll href="/tickets">All tickets</SeeAll>} empty={d.needsReply.length === 0 ? { title: "You're all caught up", hint: "Nothing is waiting on us." } : null}>
          <ul className="wlist">{d.needsReply.slice(0, 5).map((tk) => (
            <li key={tk.id}><Link href={`/support/${tk.id}`}><span className="wl-t"><b>{tk.title}</b><span>{tk.customer.displayName} · {timeAgo(tk.lastCustomerAt ?? tk.createdAt)}</span></span><Status label={(STATUS_LABEL[tk.status] ?? { label: tk.status }).label} kind={tk.status === "customer_replied" ? "warn" : "neutral"} /></Link></li>
          ))}</ul>
        </Widget>) },
    );
  }
  widgets.push(
    { id: "w-agenda", title: "Today's agenda", size: "m", node: (
      <Widget title="Today's agenda" icon={CalendarDays} action={<SeeAll href="/calendar">Calendar</SeeAll>} empty={events.length === 0 ? { title: "Nothing scheduled today", hint: <Link className="underline" href="/calendar/new">Add an event</Link> } : null}>
        <ul className="wlist">{events.slice(0, 6).map((e) => <li key={e.id}><Link href="/calendar"><span className="wl-t"><b>{e.title}</b><span>{fmtDateTime(e.startsAt)}</span></span></Link></li>)}</ul>
      </Widget>) },
    { id: "w-tasks", title: "My tasks", size: "m", node: (
      <Widget title="My tasks" icon={CheckSquare} empty={tasks.length === 0 ? { title: "You're all caught up", hint: "Tasks assigned to you appear here." } : null}>
        <ul className="wlist">{tasks.map((tk) => <li key={tk.id}><div><span className="wl-t"><b>{tk.title}</b></span><span className="text-[13px] text-muted">{fmtDate(tk.dueDate)}</span></div></li>)}</ul>
      </Widget>) },
    { id: "w-projects", title: "Projects in motion", size: "m", node: (
      <Widget title="Projects in motion" icon={FolderKanban} action={<SeeAll href="/projects">All projects</SeeAll>} empty={myProjects.length === 0 ? { title: "No projects running", hint: "A project starts automatically when a customer signs." } : null}>
        <ul className="space-y-3.5">{myProjects.map((p) => (
          <li key={p.id}><Link href={`/projects/${p.id}`} className="block"><span className="flex justify-between gap-2 text-[14.5px]"><span className="min-w-0 truncate font-semibold">{p.name}</span><span className="shrink-0 text-muted">{p.stage.replaceAll("_", " ")}</span></span><span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-black/[.07]"><span className="block h-full rounded-full bg-olive-700" style={{ width: `${Math.round((STEP[p.stage] ?? 0.1) * 100)}%` }} /></span></Link></li>
        ))}</ul>
      </Widget>) },
  );
  if (signed.length > 0) widgets.push({ id: "w-signed", title: "Recently signed", size: "m", node: (
    <Widget title="Recently signed" icon={PenLine}>
      <ul className="wlist">{signed.map((c) => <li key={c.id}><Link href={`/contracts/${c.id}`}><span className="wl-t"><b>{c.title}</b><span>{c.customer.displayName}</span></span><span className="text-[13px] text-muted">{fmtDate(c.completedAt)}</span></Link></li>)}</ul>
    </Widget>) });

  return (
    <>
      <LiveRefresh seconds={30} />
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div><h1>{greeting}, {ctx.name.split(" ")[0]}</h1><p className="mt-1 text-muted">{new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "Europe/London" }).format(new Date())}</p></div>
        <div className="hidden flex-wrap gap-2 lg:flex">{quick.map(([h, l, Icon]) => <Link key={h} href={h} className="btn btn-quiet"><Icon size={16} aria-hidden /> {l}</Link>)}</div>
      </header>
      {backupDue && <p className="mb-5 rounded-2xl border border-[#f1d58a] bg-[#fff6dc] px-4 py-3 text-sm text-[#5c3b00]"><strong>Weekly backup due.</strong> <Link className="underline" href="/backup">Download a backup</Link></p>}
      <WidgetGrid storageKey={`oss-dash:${ctx.staffId}`} widgets={widgets} />
    </>
  );
}
