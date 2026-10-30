import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { lastExport, isBackupDue } from "@/modules/export/service";
import { RecordHeader, Stat, Section, Empty, Status, fmtDateTime, fmtDate } from "@/components/ui";

export const metadata = { title: "Today" };

export default async function Today() {
  const ctx = await requireStaff();
  const w = ctx.workspaceId;
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 864e5);
  const seeCustomers = can(ctx.role, "customer.read");
  const mineOnly = can(ctx.role, "project.read_all") ? {} : { ownerId: ctx.staffId };
  const backupDue = can(ctx.role, "data.export") && isBackupDue(await lastExport(w));
  const [tasks, awaitingSig, sentProposals, activeProjects, assets, activeCustomers, events, signed] = await Promise.all([
    db.task.findMany({ where: { workspaceId: w, assigneeId: ctx.staffId, doneAt: null }, orderBy: { dueDate: "asc" }, take: 6 }),
    seeCustomers ? db.contract.count({ where: { workspaceId: w, status: "awaiting_signature" } }) : 0,
    seeCustomers ? db.proposal.count({ where: { workspaceId: w, status: "sent" } }) : 0,
    db.project.count({ where: { workspaceId: w, stage: { notIn: ["completed", "cancelled", "launched"] }, ...mineOnly } }),
    db.project.count({ where: { workspaceId: w, stage: "awaiting_assets", ...mineOnly } }),
    seeCustomers ? db.customer.count({ where: { workspaceId: w, lifecycle: "active", archivedAt: null } }) : 0,
    db.calendarEvent.findMany({ where: { workspaceId: w, status: "scheduled", startsAt: { gte: startOfDay, lt: endOfDay }, OR: [{ organiserId: ctx.staffId }, { attendees: { some: { staffId: ctx.staffId } } }] }, orderBy: { startsAt: "asc" } }),
    seeCustomers ? db.contract.findMany({ where: { workspaceId: w, status: "completed", completedAt: { gte: new Date(Date.now() - 14 * 864e5) } }, orderBy: { completedAt: "desc" }, take: 5, include: { customer: true } }) : [],
  ]);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/London" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <>
      <RecordHeader title={`${greeting}, ${ctx.name.split(" ")[0]}`} meta={new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "Europe/London" }).format(new Date())} />
      {backupDue && <p className="mb-8 rounded-lg bg-[#fff3da] px-4 py-3 text-sm text-[#5c3b00]"><strong className="font-semibold">Weekly backup due.</strong> <Link className="underline" href="/backup">Download a backup</Link></p>}
      <div className="mb-12 grid grid-cols-2 gap-x-8 gap-y-4 border-b border-line pb-8 sm:grid-cols-4">
        {seeCustomers && <Stat label="Awaiting signature" value={awaitingSig} href="/contracts?status=awaiting_signature" />}
        {seeCustomers && <Stat label="Proposals out" value={sentProposals} href="/proposals?status=sent" />}
        <Stat label="Projects in progress" value={activeProjects} href="/projects" hint={assets ? `${assets} waiting on client assets` : undefined} />
        {seeCustomers && <Stat label="Active customers" value={activeCustomers} href="/customers" />}
      </div>
      <div className="grid gap-x-12 lg:grid-cols-2">
        <Section title="My tasks">
          {tasks.length === 0 ? <Empty title="You're all caught up" /> : <ul>{tasks.map((t) => <li key={t.id} className="row flex justify-between gap-3 py-3"><span>{t.title}</span><span className="shrink-0 text-sm text-muted">{fmtDate(t.dueDate)}</span></li>)}</ul>}
        </Section>
        <Section title="Today's agenda" action={<Link className="text-sm text-muted hover:text-ink" href="/calendar">Calendar</Link>}>
          {events.length === 0 ? <Empty title="Nothing scheduled today"><Link className="underline" href="/calendar/new">Add an event</Link></Empty> : <ul>{events.map((e) => <li key={e.id} className="row"><Link href="/calendar" className="block py-3"><span className="block text-sm text-muted">{fmtDateTime(e.startsAt)}</span>{e.title}</Link></li>)}</ul>}
        </Section>
      </div>
      {signed.length > 0 && (
        <Section title="Recently signed">
          <ul>{signed.map((c) => <li key={c.id} className="row"><Link href={`/contracts/${c.id}`} className="flex min-h-12 items-center justify-between gap-3 py-3 hover:bg-soft sm:-mx-3 sm:rounded-lg sm:px-3"><span className="min-w-0"><span className="font-medium">{c.customer.displayName}</span><span className="block truncate text-sm text-muted">{c.title}</span></span><span className="flex shrink-0 items-center gap-3"><Status label="signed" kind="good" /><span className="hidden text-sm text-muted sm:inline">{c.completedAt && fmtDateTime(c.completedAt)}</span></span></Link></li>)}</ul>
        </Section>
      )}
    </>
  );
}
