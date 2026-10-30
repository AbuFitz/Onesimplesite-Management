import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { RecordHeader, Empty, fmtDateTime, fmtDate } from "@/components/ui";

export const metadata = { title: "Today" };

export default async function Today() {
  const ctx = await requireStaff();
  const w = ctx.workspaceId;
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 864e5);
  const seeCustomers = can(ctx.role, "customer.read");
  const [tasks, awaitingSig, sentProposals, assets, events, signed] = await Promise.all([
    db.task.findMany({ where: { workspaceId: w, assigneeId: ctx.staffId, doneAt: null }, orderBy: { dueDate: "asc" }, take: 8 }),
    seeCustomers ? db.contract.count({ where: { workspaceId: w, status: "awaiting_signature" } }) : 0,
    seeCustomers ? db.proposal.count({ where: { workspaceId: w, status: "sent" } }) : 0,
    db.project.count({ where: { workspaceId: w, stage: "awaiting_assets", ...(can(ctx.role, "project.read_all") ? {} : { ownerId: ctx.staffId }) } }),
    db.calendarEvent.findMany({ where: { workspaceId: w, status: "scheduled", startsAt: { gte: startOfDay, lt: endOfDay }, OR: [{ organiserId: ctx.staffId }, { attendees: { some: { staffId: ctx.staffId } } }] }, orderBy: { startsAt: "asc" } }),
    seeCustomers ? db.contract.findMany({ where: { workspaceId: w, status: "completed", completedAt: { gte: new Date(Date.now() - 7 * 864e5) } }, orderBy: { completedAt: "desc" }, take: 5, include: { customer: true } }) : [],
  ]);
  const links = [
    seeCustomers && { href: "/contracts?status=awaiting_signature", n: awaitingSig, label: "Contracts awaiting signature" },
    seeCustomers && { href: "/proposals?status=sent", n: sentProposals, label: "Proposals awaiting a response" },
    { href: "/projects?stage=awaiting_assets", n: assets, label: "Projects waiting on client assets" },
  ].filter(Boolean) as { href: string; n: number; label: string }[];
  return (
    <>
      <RecordHeader title={`Today, ${ctx.name.split(" ")[0]}`} action={can(ctx.role, "customer.write") && <Link href="/customers/new" className="btn hidden lg:inline-flex">New enquiry</Link>} />
      <section aria-labelledby="needs" className="mb-8">
        <h2 id="needs" className="mb-2">Needs attention</h2>
        <ul>
          {links.map((l) => (
            <li key={l.href} className="row"><Link href={l.href} className="flex items-center justify-between min-h-12 py-2 hover:bg-wash px-1"><span>{l.label}</span><strong className="tabular-nums">{l.n}</strong></Link></li>
          ))}
        </ul>
      </section>
      {signed.length > 0 && (
        <section aria-labelledby="signed" className="mb-8"><h2 id="signed" className="mb-2">Recently signed</h2>
          <ul>{signed.map((c) => <li key={c.id} className="row"><Link href={`/contracts/${c.id}`} className="flex justify-between gap-3 min-h-12 py-2 hover:bg-wash px-1"><span>{c.customer.displayName} · {c.title}</span><span className="text-sm text-muted">{c.completedAt && fmtDateTime(c.completedAt)}</span></Link></li>)}</ul></section>
      )}
      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="tasks">
          <h2 id="tasks" className="mb-2">My tasks</h2>
          {tasks.length === 0 ? <Empty title="No open tasks assigned to you" /> : (
            <ul>{tasks.map((t) => <li key={t.id} className="row py-3 flex justify-between gap-3"><span>{t.title}</span><span className="text-sm text-muted shrink-0">{fmtDate(t.dueDate)}</span></li>)}</ul>
          )}
        </section>
        <section aria-labelledby="agenda">
          <h2 id="agenda" className="mb-2">Today’s agenda</h2>
          {events.length === 0 ? <Empty title="Nothing scheduled today"><Link className="underline" href="/calendar/new">Add an event</Link></Empty> : (
            <ul>{events.map((e) => <li key={e.id} className="row py-3"><Link href={`/calendar?focus=${e.id}`} className="block"><span className="text-sm text-muted">{fmtDateTime(e.startsAt)}</span><br />{e.title}</Link></li>)}</ul>
          )}
        </section>
      </div>
    </>
  );
}
