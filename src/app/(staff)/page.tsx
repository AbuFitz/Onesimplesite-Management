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
import { Widget, SeeAll, Kpi } from "@/components/widgets/widget";
import { RangeProvider, RangeSwitch, ByRange } from "@/components/widgets/ranged";
import { Series, Funnel, Delta } from "@/components/widgets/spark";
import { WidgetGrid, type GridWidget } from "@/components/widgets/grid";
import { DetailStats, DetailList } from "@/components/widgets/detail";
import { LiveRefresh } from "@/components/live-refresh";
import { Status, fmtDateTime, fmtDate, timeAgo } from "@/components/ui";

export const metadata = { title: "Today" };
const gbp = (minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(minor / 100);

export default async function Today({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const DAYS = [7, 30, 90] as const;
  const w = ctx.workspaceId;
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 864e5);
  const seeBusiness = can(ctx.role, "customer.read");
  const mineOnly = can(ctx.role, "project.read_all") ? {} : { ownerId: ctx.staffId };
  const backupDue = can(ctx.role, "data.export") && isBackupDue(await lastExport(w));
  const [d, trendSet, tasks, events, signed, myProjects] = await Promise.all([
    todayData(w, { staffId: ctx.staffId, seeBusiness }),
    seeBusiness ? Promise.all(DAYS.map((n) => todayTrends(w, n))) : null,
    db.task.findMany({ where: { workspaceId: w, assigneeId: ctx.staffId, doneAt: null }, orderBy: { dueDate: "asc" }, take: 6 }),
    db.calendarEvent.findMany({ where: { workspaceId: w, status: "scheduled", startsAt: { gte: startOfDay, lt: endOfDay }, OR: [{ organiserId: ctx.staffId }, { attendees: { some: { staffId: ctx.staffId } } }] }, orderBy: { startsAt: "asc" } }),
    seeBusiness ? db.contract.findMany({ where: { workspaceId: w, status: "completed", cancelledAt: null, completedAt: { gte: new Date(Date.now() - 14 * 864e5) } }, orderBy: { completedAt: "desc" }, take: 4, include: { customer: true } }) : [],
    db.project.findMany({ where: { workspaceId: w, stage: { notIn: ["completed", "cancelled", "launched"] }, ...mineOnly }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, name: true, stage: true, dueDate: true, customer: { select: { displayName: true } } } }),
  ]);
  const greeting = hello();
  const STEP = { planned: 0.1, awaiting_assets: 0.2, design: 0.4, development: 0.6, qa: 0.75, client_review: 0.85, ready_to_launch: 0.95 } as Record<string, number>;
  const quick = [["/tickets/new", "New ticket", Ticket], ["/customers/new", "Add a company", Building2], ["/calendar/new", "Add an event", CalendarDays]] as const;
  const gbpShort = (n: number) => `£${n.toLocaleString("en-GB")}`;
  const widgets: GridWidget[] = [];

  if (d && trendSet) {
    const t = trendSet[1];   // the small tiles show the 30 day trend; the bigger widgets each pick their own range
    const per = "last 30 days";
    const byDays = { 7: trendSet[0], 30: trendSet[1], 90: trendSet[2] } as const;
    const stageName: Record<string, string> = { new: "New enquiries", qualified: "Quote in progress", proposal_sent: "Quote sent", contract_pending: "Waiting to sign", won: "Won" };
    const replyItems = d.needsReply.slice(0, 5).map((tk) => ({ key: tk.id, href: `/support/${tk.id}`, title: tk.title, sub: `${tk.customer.displayName} · ${timeAgo(tk.lastCustomerAt ?? tk.createdAt)}` }));
    const dNeeds = <><DetailStats stats={[{ label: "Needs us", value: d.tickets.open, tone: d.tickets.open ? "warn" : "good" }, { label: "Waiting on customer", value: d.tickets.waiting }, { label: "Done", value: d.tickets.done }]} /><DetailList title="Customers waiting on a reply" items={replyItems} empty="Nobody is waiting on us." /></>;
    const dSign = <><DetailStats stats={[{ label: "Waiting to sign", value: d.awaiting }, { label: "Signed (30 days)", value: t.signed.total }]} /><DetailList title="Where the pipeline is" items={Object.entries(stageName).map(([k, l]) => ({ key: k, title: l, end: <b className="num">{d.pipeline[k] ?? 0}</b> }))} /></>;
    const dCollect = <><DetailStats stats={[{ label: "To collect", value: gbp(d.money.dueMinor), tone: d.money.dueMinor ? "warn" : "good" }, { label: "Unpaid", value: d.money.dueCount }, { label: "Failed", value: d.money.pastDue, tone: d.money.pastDue ? "bad" : undefined }]} /><p className="dr-note">{d.money.pastDue ? "Failed payments need a nudge first: the customer's card was declined." : "Everything due is waiting for the customer to pay."}</p></>;
    const dPlans = <><DetailStats stats={[{ label: "Per month", value: gbpShort(Math.round(d.money.monthlyMinor / 100)), tone: "good" }, { label: "Active plans", value: d.money.plans }]} /><p className="dr-note">Plans count once they are paying. Free months aren&apos;t included.</p></>;
    const rangeStats = (pick: (n: 7 | 30 | 90) => { total: number; prev: number }, fmt: (n: number) => string) => [7, 30, 90].map((n) => { const x = pick(n as 7 | 30 | 90); return { label: `Last ${n} days`, value: fmt(x.total), tone: (x.total >= x.prev ? "good" : "warn") as "good" | "warn" }; });
    const dNew = <><DetailStats stats={rangeStats((n) => byDays[n].tickets, String)} /><DetailList title="Waiting for a reply" items={replyItems} empty="Nobody is waiting on us." /></>;
    const dMoney = <><DetailStats stats={rangeStats((n) => byDays[n].money, gbpShort)} /><p className="dr-note">Monthly plans running: {gbpShort(Math.round(d.money.monthlyMinor / 100))} a month across {d.money.plans} {d.money.plans === 1 ? "plan" : "plans"}.</p></>;
    const dHealth = <><DetailStats stats={[{ label: "Replied in time", value: `${Math.round(d.replyHealth * 100)}%`, tone: d.replyHealth > 0.8 ? "good" : d.replyHealth > 0.5 ? "warn" : "bad" }, { label: "Sites live", value: `${d.projects.live}/${d.projects.total}` }]} /><p className="dr-note">Replied in time is the share of customers waiting on us whose wait is still inside our promise for that kind of ticket.</p></>;
    widgets.push(
      { id: "k-needs", title: "Needs us", size: "s", node: <Kpi label="Needs us" tone="blue" detail={dNeeds} linkLabel="Open tickets" value={d.tickets.open} href="/tickets" note={d.tickets.replied ? `${d.tickets.replied} customer ${d.tickets.replied === 1 ? "reply" : "replies"}` : "All answered"} spark={t.tickets.series.map((p) => p.value)} sparkLabel={`Tickets per period, ${per}`} /> },
      { id: "k-sign", title: "Waiting to sign", size: "s", node: <Kpi label="Waiting to sign" tone="amber" detail={dSign} linkLabel="Open agreements" value={d.awaiting} href="/agreements?show=awaiting" note={`${d.pipeline.contract_pending ?? 0} in the pipeline`} spark={t.signed.series.map((p) => p.value)} sparkLabel={`Agreements signed, ${per}`} /> },
      { id: "k-collect", title: "To collect", size: "s", node: <Kpi label="To collect" tone="rose" detail={dCollect} linkLabel="Open payments" value={gbp(d.money.dueMinor)} href={d.money.pastDue && !d.money.dueCount ? "/payments?show=failed" : "/payments?show=due"} note={d.money.pastDue ? `${d.money.pastDue} failed · ${d.money.dueCount} due` : `${d.money.dueCount} unpaid`} /> },
      { id: "k-plans", title: "Monthly plans", size: "s", node: <Kpi label="Monthly plans" tone="violet" detail={dPlans} linkLabel="Open plans" value={gbpShort(Math.round(d.money.monthlyMinor / 100))} href="/payments?show=plans" note={`${d.money.plans} active ${d.money.plans === 1 ? "plan" : "plans"}`} /> },
      { id: "w-tickets", title: "Tickets right now", size: "m", node: (
        <Widget title="Tickets right now" icon={Ticket} drill={{ href: "/tickets?tab=all", label: "Open tickets", detail: dNeeds }} action={<SeeAll href="/tickets?tab=all">See them</SeeAll>} empty={d.tickets.open + d.tickets.waiting + d.tickets.done === 0 ? { title: "No tickets yet", hint: "They appear here when a customer asks for help." } : null}>
          <Donut slices={[{ label: "Needs us", value: d.tickets.open, color: CHART.green }, { label: "Waiting on customer", value: d.tickets.waiting, color: CHART.amber }, { label: "Done", value: d.tickets.done, color: CHART.teal }]} centre={<div><p className="font-[family-name:var(--font-display)] text-3xl font-medium leading-none">{d.tickets.open + d.tickets.waiting}</p><p className="text-xs text-muted">open</p></div>} />
        </Widget>) },
      { id: "w-new-tickets", title: "New tickets", size: "m", node: (
        <RangeProvider id="w-new-tickets">
          <Widget title="New tickets" icon={Ticket} drill={{ href: "/tickets?tab=all", label: "Open tickets", detail: dNew }} range={<RangeSwitch />} action={<SeeAll href="/tickets?tab=all">See them</SeeAll>}>
            <ByRange views={Object.fromEntries(DAYS.map((n) => { const x = byDays[n].tickets; return [n, x.total === 0 && x.prev === 0 ? <div key={n} className="wdg-quiet"><b>No new tickets in the last {n} days</b><span>Good news, or a quiet spell.</span></div> : (<div key={n}>
              <p className="wdg-big"><span className="num">{x.total}</span><Delta now={x.total} prev={x.prev} goodWhen="down" label="vs the period before" /></p>
              <Series data={x.series} color={CHART.lilac} height={140} /></div>)]; })) as Record<7 | 30 | 90, React.ReactNode>} />
          </Widget>
        </RangeProvider>) },
      { id: "w-money", title: "Money in", size: "m", node: (
        <RangeProvider id="w-money">
          <Widget title="Money in" icon={CreditCard} drill={{ href: "/payments?show=paid", label: "Open payments", detail: dMoney }} range={<RangeSwitch />} action={<SeeAll href="/payments?show=paid">Payments</SeeAll>}
            foot={<>Monthly plans running: <b className="num">{gbpShort(Math.round(d.money.monthlyMinor / 100))}</b> a month ({d.money.plans})</>}>
            <ByRange views={Object.fromEntries(DAYS.map((n) => { const x = byDays[n].money; return [n, x.total === 0 && x.prev === 0 ? <div key={n} className="wdg-quiet"><b>No payments in the last {n} days</b><span>Receipts show here as money arrives.</span></div> : (<div key={n}>
              <p className="wdg-big"><span className="num">{gbpShort(x.total)}</span><Delta now={x.total} prev={x.prev} label="vs the period before" /></p>
              <Series data={x.series} kind="area" color={CHART.teal} height={140} format={gbpShort} /></div>)]; })) as Record<7 | 30 | 90, React.ReactNode>} />
          </Widget>
        </RangeProvider>) },
      { id: "w-health", title: "How we're doing", size: "m", node: (
        <Widget title="How we're doing" icon={Trophy} drill={{ href: "/projects", label: "Open projects", detail: dHealth }} action={<SeeAll href="/projects">Projects</SeeAll>}>
          <div className="space-y-5">
            <Ring value={d.replyHealth} color={d.replyHealth > 0.8 ? CHART.teal : d.replyHealth > 0.5 ? CHART.amber : CHART.rose} label="Replied in time" sub="of tickets waiting on us" />
            <Ring value={d.projects.total ? d.projects.live / d.projects.total : 0} color={CHART.green} label="Sites live" sub={`${d.projects.live} of ${d.projects.total} projects`} />
          </div>
        </Widget>) },
      { id: "w-pipeline", title: "Sales pipeline", size: "m", node: (
        <Widget title="Sales pipeline" icon={PenLine} drill={{ href: "/agreements", label: "Open agreements", detail: dSign }} action={<SeeAll href="/agreements">All agreements</SeeAll>} foot={<>New enquiries in the {per}: <b className="num">{t.enquiries.total}</b> <Delta now={t.enquiries.total} prev={t.enquiries.prev} /></>}>
          <Funnel stages={([["new", "New enquiries", CHART.blue, "draft"], ["qualified", "Quote in progress", CHART.lilac, "draft"], ["proposal_sent", "Quote sent", CHART.amber, "awaiting"], ["contract_pending", "Waiting to sign", CHART.rose, "awaiting"], ["won", "Signed", CHART.teal, "signed"]] as const).map(([k, label, color, show]) => ({ label, color, value: d.pipeline[k] ?? 0, href: `/agreements?show=${show}` }))} />
        </Widget>) },
      { id: "w-reply", title: "Needs your reply", size: "m", node: (
        <Widget title="Needs your reply" icon={Repeat} drill={{ href: "/tickets", label: "Open tickets", detail: dNeeds }} action={<SeeAll href="/tickets">All tickets</SeeAll>} empty={d.needsReply.length === 0 ? { title: "You're all caught up", hint: "Nothing is waiting on us." } : null}>
          <ul className="wlist">{d.needsReply.slice(0, 5).map((tk) => (
            <li key={tk.id}><Link href={`/support/${tk.id}`}><span className="wl-t"><b>{tk.title}</b><span>{tk.customer.displayName} · {timeAgo(tk.lastCustomerAt ?? tk.createdAt)}</span></span><Status label={(STATUS_LABEL[tk.status] ?? { label: tk.status }).label} kind={tk.status === "customer_replied" ? "warn" : "neutral"} /></Link></li>
          ))}</ul>
        </Widget>) },
    );
  }
  widgets.push(
    { id: "w-agenda", title: "Today's agenda", size: "m", node: (
      <Widget title="Today's agenda" icon={CalendarDays} drill={{ href: "/calendar", label: "Open calendar", detail: <DetailList title="Today" items={events.map((e) => ({ key: e.id, title: e.title, sub: fmtDateTime(e.startsAt) }))} empty="Nothing scheduled today." /> }} action={<SeeAll href="/calendar">Calendar</SeeAll>} empty={events.length === 0 ? { title: "Nothing scheduled today", hint: <Link className="underline" href="/calendar/new">Add an event</Link> } : null}>
        <ul className="wlist">{events.slice(0, 6).map((e) => <li key={e.id}><Link href="/calendar"><span className="wl-t"><b>{e.title}</b><span>{fmtDateTime(e.startsAt)}</span></span></Link></li>)}</ul>
      </Widget>) },
    { id: "w-tasks", title: "My tasks", size: "m", node: (
      <Widget title="My tasks" icon={CheckSquare} drill={{ href: "/calendar", label: "Open calendar", detail: <DetailList title="Open tasks" items={tasks.map((tk) => ({ key: tk.id, title: tk.title, sub: tk.dueDate ? `Due ${fmtDate(tk.dueDate)}` : undefined }))} empty="You're all caught up." /> }} empty={tasks.length === 0 ? { title: "You're all caught up", hint: "Tasks assigned to you appear here." } : null}>
        <ul className="wlist">{tasks.map((tk) => <li key={tk.id}><div><span className="wl-t"><b>{tk.title}</b></span><span className="text-[13px] text-muted">{fmtDate(tk.dueDate)}</span></div></li>)}</ul>
      </Widget>) },
    { id: "w-projects", title: "Projects in motion", size: "m", node: (
      <Widget title="Projects in motion" icon={FolderKanban} drill={{ href: "/projects", label: "Open projects", detail: <DetailList title="Running now" items={myProjects.map((p) => ({ key: p.id, href: `/projects/${p.id}`, title: p.name, sub: p.stage.replaceAll("_", " ") }))} empty="No projects running." /> }} action={<SeeAll href="/projects">All projects</SeeAll>} empty={myProjects.length === 0 ? { title: "No projects running", hint: "A project starts automatically when a customer signs." } : null}>
        <ul className="space-y-3.5">{myProjects.map((p) => (
          <li key={p.id}><Link href={`/projects/${p.id}`} className="block"><span className="flex justify-between gap-2 text-[14.5px]"><span className="min-w-0 truncate font-semibold">{p.name}</span><span className="shrink-0 text-muted">{p.stage.replaceAll("_", " ")}</span></span><span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-black/[.07]"><span className="block h-full rounded-full bg-olive-700" style={{ width: `${Math.round((STEP[p.stage] ?? 0.1) * 100)}%` }} /></span></Link></li>
        ))}</ul>
      </Widget>) },
  );
  if (signed.length > 0) widgets.push({ id: "w-signed", title: "Recently signed", size: "m", node: (
    <Widget title="Recently signed" icon={PenLine} drill={{ href: "/agreements", label: "Open agreements", detail: <DetailList title="Signed in the last 2 weeks" items={signed.map((c) => ({ key: c.id, href: `/contracts/${c.id}`, title: c.title, sub: c.customer.displayName }))} /> }}>
      <ul className="wlist">{signed.map((c) => <li key={c.id}><Link href={`/contracts/${c.id}`}><span className="wl-t"><b>{c.title}</b><span>{c.customer.displayName}</span></span><span className="text-[13px] text-muted">{fmtDate(c.completedAt)}</span></Link></li>)}</ul>
    </Widget>) });

  return (
    <>
      <LiveRefresh seconds={90} />
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div><h1>{greeting}, {ctx.name.split(" ")[0]}</h1><p className="mt-1 text-muted">{new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "Europe/London" }).format(new Date())}</p></div>
        <div className="hidden flex-wrap gap-2 lg:flex">{quick.map(([h, l, Icon]) => <Link key={h} href={h} className="btn btn-quiet"><Icon size={16} aria-hidden /> {l}</Link>)}</div>
      </header>
      {backupDue && <p className="mb-5 rounded-2xl border border-[#f1d58a] bg-[#fff6dc] px-4 py-3 text-sm text-[#5c3b00]"><strong>Weekly backup due.</strong> <Link className="underline" href="/backup">Download a backup</Link></p>}
      <WidgetGrid storageKey={`oss-dash:${ctx.staffId}`} widgets={widgets} />
    </>
  );
}
