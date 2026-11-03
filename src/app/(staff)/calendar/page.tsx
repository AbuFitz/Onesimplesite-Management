import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Clock, FolderKanban, CheckSquare, Download, X } from "lucide-react";
import { db } from "@/lib/db";
import { Panel, SummaryTile } from "@/components/panel";
import { can } from "@/modules/identity/permissions";
import { requireStaff } from "@/modules/identity/session";
import { listEvents } from "@/modules/calendar/service";
import { cancelEventAction, quickEventAction } from "@/app/actions/work";
import { RecordHeader, Status, Empty, ErrorSummary, fmtDate } from "@/components/ui";

export const metadata = { title: "Calendar" };

const TZ = "Europe/London";
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); // YYYY-MM-DD
const timeOf = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function Calendar({ searchParams }: { searchParams: Promise<{ scope?: string; error?: string; month?: string; day?: string }> }) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const scope = sp.scope === "team" ? "team" : "mine";
  const today = dayKey(new Date());
  const m = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : today.slice(0, 7);
  const [y, mo] = m.split("-").map(Number);
  const first = utc(y, mo - 1, 1);
  const gridStart = utc(y, mo - 1, 1 - ((first.getUTCDay() + 6) % 7)); // Monday on or before the 1st
  const cells = Array.from({ length: 42 }, (_, i) => utc(gridStart.getUTCFullYear(), gridStart.getUTCMonth(), gridStart.getUTCDate() + i));
  const events = await listEvents(ctx, new Date(gridStart.getTime() - 864e5), new Date(cells[41].getTime() + 2 * 864e5), scope);
  const gridEnd = new Date(cells[41].getTime() + 864e5);
  const [dueProjects, dueTasks] = await Promise.all([
    db.project.findMany({ where: { workspaceId: ctx.workspaceId, dueDate: { gte: gridStart, lt: gridEnd }, stage: { notIn: ["completed", "cancelled"] } }, select: { id: true, name: true, dueDate: true, customer: { select: { displayName: true } } } }),
    db.task.findMany({ where: { workspaceId: ctx.workspaceId, assigneeId: ctx.staffId, doneAt: null, dueDate: { gte: gridStart, lt: gridEnd } }, select: { id: true, title: true, dueDate: true } }),
  ]);
  const marks = new Map<string, { kind: "project" | "task"; id: string; label: string }[]>();
  for (const p of dueProjects) if (p.dueDate) marks.set(iso(p.dueDate), [...(marks.get(iso(p.dueDate)) ?? []), { kind: "project", id: p.id, label: p.name }]);
  for (const t of dueTasks) if (t.dueDate) marks.set(iso(t.dueDate), [...(marks.get(iso(t.dueDate)) ?? []), { kind: "task", id: t.id, label: t.title }]);
  const byDay = new Map<string, typeof events>();
  for (const e of events) { const k = dayKey(e.startsAt); byDay.set(k, [...(byDay.get(k) ?? []), e]); }

  const selected = /^\d{4}-\d{2}-\d{2}$/.test(sp.day ?? "") ? sp.day! : (today.startsWith(m) ? today : `${m}-01`);
  const dayEvents = byDay.get(selected) ?? [];
  const href = (o: { month?: string; day?: string }) => {
    const q = new URLSearchParams(); if (scope === "team") q.set("scope", "team"); q.set("month", o.month ?? m); if (o.day) q.set("day", o.day);
    return `/calendar?${q}`;
  };
  const shift = (n: number) => { const d = utc(y, mo - 1 + n, 1); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
  const title = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const selLabel = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${selected}T12:00:00Z`));

  const inMonthEvents = events.filter((e) => dayKey(e.startsAt).slice(0, 7) === m && e.status !== "cancelled");
  const upcoming = events.filter((e) => e.status === "scheduled" && e.startsAt >= new Date()).slice(0, 5);
  const busiest = [...byDay.entries()].filter(([k]) => k.startsWith(m)).sort((a, b) => b[1].length - a[1].length)[0];
  const dueSoon = [...marks.entries()].filter(([k]) => k >= today).sort(([a], [b]) => a.localeCompare(b)).flatMap(([k, list]) => list.map((x) => ({ ...x, k }))).slice(0, 6);
  const dayMarks = marks.get(selected) ?? [];
  const canWrite = can(ctx.role, "calendar.write");

  return (
    <>
      <RecordHeader title="Calendar" meta="Everything with a date: meetings, project due dates and your tasks" action={canWrite ? <Link href="/calendar/new" className="btn"><Plus size={16} aria-hidden /> New event</Link> : undefined} />
      <ErrorSummary message={sp.error} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile tone="blue" label="Events this month" value={inMonthEvents.length} sub={scope === "team" ? "whole team" : "yours"} />
        <SummaryTile tone="amber" label="Busiest day" value={busiest ? new Date(`${busiest[0]}T12:00:00Z`).getUTCDate() : "None"} sub={busiest ? `${busiest[1].length} events` : "a quiet month"} />
        <SummaryTile tone="rose" label="Projects due" value={dueProjects.filter((p) => p.dueDate && iso(p.dueDate).startsWith(m)).length} sub="this month" />
        <SummaryTile tone="green" label="Your tasks due" value={dueTasks.filter((t) => t.dueDate && iso(t.dueDate).startsWith(m)).length} sub="this month" />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <section aria-label="Month" className="overflow-hidden rounded-2xl border border-[var(--card-line)] bg-white shadow-[0_1px_2px_rgba(14,19,17,.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-rule)] bg-[var(--card-head)] px-4 py-3">
            <div className="flex items-center gap-1.5">
              <Link aria-label="Previous month" className="btn btn-quiet !min-h-9 !w-9 !px-0" href={href({ month: shift(-1), day: undefined })}><ChevronLeft size={17} /></Link>
              <h2 className="min-w-40 text-center text-lg font-bold">{title}</h2>
              <Link aria-label="Next month" className="btn btn-quiet !min-h-9 !w-9 !px-0" href={href({ month: shift(1), day: undefined })}><ChevronRight size={17} /></Link>
              <Link className="btn btn-quiet !min-h-9 ml-1" href={href({ month: today.slice(0, 7), day: today })}>Today</Link>
            </div>
            <nav aria-label="Whose events" className="flex gap-1.5">
              <Link className={`btn !min-h-9 ${scope === "mine" ? "btn-dark" : "btn-quiet"}`} href={`/calendar?month=${m}&day=${selected}`}>Mine</Link>
              <Link className={`btn !min-h-9 ${scope === "team" ? "btn-dark" : "btn-quiet"}`} href={`/calendar?scope=team&month=${m}&day=${selected}`}>Team</Link>
            </nav>
          </div>
          <div className="grid grid-cols-7 border-b border-[var(--card-rule)] bg-white text-center text-[13px] font-bold text-ink/70">
            {DOW.map((d) => <div key={d} className="py-2"><span className="sm:hidden">{d[0]}</span><span className="hidden sm:inline">{d}</span></div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((c, i) => {
              const k = iso(c), inMonth = k.slice(0, 7) === m, list = byDay.get(k) ?? [], mk = marks.get(k) ?? [], isToday = k === today, isSel = k === selected;
              const total = list.length + mk.length;
              return (
                <div key={k} className={`group relative flex min-h-[3.75rem] flex-col gap-1 border-[var(--card-rule)] p-1.5 sm:min-h-[6.75rem] ${i % 7 !== 6 ? "border-r" : ""} ${i < 35 ? "border-b" : ""} ${inMonth ? "bg-white" : "bg-[var(--color-soft)] text-ink/45"} ${isSel ? "!bg-[#f4f4f5] ring-2 ring-inset ring-[#18181b]" : ""}`}>
                  <Link href={href({ day: k })} aria-label={`${k}${total ? `, ${total} item${total > 1 ? "s" : ""}` : ""}`} aria-current={isToday ? "date" : undefined} className="absolute inset-0 hover:bg-[#18181b]/5" />
                  <span className="pointer-events-none relative flex items-center justify-between">
                    <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-[13.5px] font-semibold ${isToday ? "bg-[#18181b] text-white" : ""}`}>{c.getUTCDate()}</span>
                  </span>
                  {canWrite && inMonth && <Link href={`${href({ day: k })}#add`} aria-label={`Add an event on ${k}`} className="absolute right-1 top-1 z-10 hidden size-7 place-items-center rounded-lg bg-[#18181b] text-white opacity-0 shadow-sm transition-opacity focus:opacity-100 group-hover:opacity-100 sm:grid"><Plus size={15} aria-hidden /></Link>}
                  <span className="pointer-events-none relative flex flex-wrap gap-0.5 sm:hidden">{list.slice(0, 3).map((e) => <span key={e.id} className="h-1.5 w-1.5 rounded-full bg-[#18181b]" />)}{mk.slice(0, 2).map((x) => <span key={x.id} className={`h-1.5 w-1.5 rounded-full ${x.kind === "project" ? "bg-[#f5a524]" : "bg-[#2450d6]"}`} />)}</span>
                  <span className="pointer-events-none relative hidden flex-col gap-0.5 sm:flex">
                    {list.slice(0, 2).map((e) => <span key={e.id} className={`truncate rounded-md bg-[#f1f1f3] border border-[#e4e4e7] px-1.5 py-0.5 text-[12px] font-semibold text-[#18181b] ${e.status === "cancelled" ? "line-through opacity-60" : ""}`}>{timeOf(e.startsAt)} {e.title}</span>)}
                    {mk.slice(0, Math.max(0, 3 - Math.min(list.length, 2))).map((x) => <span key={x.id} className={`truncate rounded-md px-1.5 py-0.5 text-[12px] font-semibold ${x.kind === "project" ? "bg-[#fdeccb] text-[#7a4a00]" : "bg-[#e3ebff] text-[#1e3fae]"}`}>{x.kind === "project" ? "Due: " : "Task: "}{x.label}</span>)}
                    {total > 3 && <span className="px-1 text-[12px] font-semibold text-ink/65">+{total - 3} more</span>}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 border-t border-[var(--card-rule)] bg-[var(--card-head)] px-4 py-2.5 text-[13px] text-ink/75">
            <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-[#18181b]" /> Event</span><span className="flex items-center gap-1.5"><span className="size-3 rounded bg-[#f5a524]" /> Project due</span><span className="flex items-center gap-1.5"><span className="size-3 rounded bg-[#2450d6]" /> Your task due</span>
          </div>
        </section>

        <aside className="space-y-5">
          <Panel title={selLabel} icon={CalendarDays} tone="blue">
            {canWrite && (
              <form id="add" action={quickEventAction} className="scroll-mt-24 mb-4 space-y-3 rounded-xl border border-[#e4e4e7] bg-[#fafafa] p-3">
                <input type="hidden" name="date" value={selected} /><input type="hidden" name="month" value={m} />
                <p className="flex items-center gap-1.5 text-[15px] font-bold"><Plus size={16} aria-hidden /> Add to this day</p>
                <div><label className="label" htmlFor="qe-t">What is it?</label><input id="qe-t" name="title" className="field" placeholder="e.g. Call with Alex" required autoComplete="off" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="label" htmlFor="qe-s">Starts</label><input id="qe-s" name="time" type="time" className="field" defaultValue="09:00" required step={900} /></div>
                  <div><label className="label" htmlFor="qe-d">Length</label><select id="qe-d" name="minutes" className="field" defaultValue="60">{[[15, "15 min"], [30, "30 min"], [60, "1 hour"], [90, "1.5 hours"], [120, "2 hours"], [240, "Half a day"], [480, "All day"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                </div>
                <div><label className="label" htmlFor="qe-l">Where? <span className="font-normal text-ink/60">(optional)</span></label><input id="qe-l" name="location" className="field" autoComplete="off" /></div>
                <button className="btn w-full">Add event</button>
                <p className="text-center text-[13px] text-ink/65">More options? <Link className="underline" href="/calendar/new">Full event form</Link></p>
              </form>
            )}
            {dayEvents.length === 0 && dayMarks.length === 0 && <p className="mb-1 text-[15px] text-ink/70">Nothing on this day yet.</p>}
            {dayEvents.length > 0 && <ul className="mb-3 max-h-80 divide-y divide-[var(--card-rule)] overflow-y-auto pr-1">{dayEvents.map((e) => (
              <li key={e.id} className="py-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-[#18181b]"><Clock size={14} aria-hidden />{timeOf(e.startsAt)} to {timeOf(e.endsAt)}</p>
                <p className={`mt-0.5 break-words font-bold ${e.status === "cancelled" ? "line-through" : ""}`}>{e.title}</p>
                {e.location && <p className="break-all text-sm text-ink/70">{e.location}</p>}
                {e.status === "cancelled" && <Status label="cancelled" kind="bad" />}
                <div className="mt-2 flex flex-wrap gap-2"><a className="btn btn-quiet !min-h-8 text-[13px]" href={`/calendar/${e.id}/ics`}><Download size={14} aria-hidden /> Add to my calendar</a>
                  {canWrite && e.status === "scheduled" && <form action={cancelEventAction}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="version" value={e.version} /><button className="btn btn-quiet !min-h-8 text-[13px]"><X size={14} aria-hidden /> Cancel event</button></form>}</div>
              </li>))}</ul>}
            {dayMarks.length > 0 && <ul className="mb-3 space-y-1.5">{dayMarks.map((x) => <li key={x.id}><Link className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[15px] font-semibold ${x.kind === "project" ? "bg-[#fdeccb] text-[#7a4a00]" : "bg-[#e3ebff] text-[#1e3fae]"}`} href={x.kind === "project" ? `/projects/${x.id}` : "/"}>{x.kind === "project" ? <FolderKanban size={15} aria-hidden /> : <CheckSquare size={15} aria-hidden />}{x.kind === "project" ? "Project due: " : "Task due: "}{x.label}</Link></li>)}</ul>}
          </Panel>

          <Panel title="Next up" icon={Clock} tone="lilac">
            {upcoming.length === 0 ? <p className="text-[15px] text-ink/70">Nothing coming up.</p> : <ul className="divide-y divide-[var(--card-rule)]">{upcoming.map((e) => <li key={e.id}><Link href={href({ month: dayKey(e.startsAt).slice(0, 7), day: dayKey(e.startsAt) })} className="flex items-center justify-between gap-3 py-2.5"><span className="min-w-0 truncate font-semibold">{e.title}</span><span className="shrink-0 text-sm text-ink/70">{new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ }).format(e.startsAt)} {timeOf(e.startsAt)}</span></Link></li>)}</ul>}
          </Panel>

          <Panel title="Due soon" icon={FolderKanban} tone="amber">
            {dueSoon.length === 0 ? <p className="text-[15px] text-ink/70">No project or task due dates coming up this month.</p> : <ul className="divide-y divide-[var(--card-rule)]">{dueSoon.map((x) => <li key={x.kind + x.id} className="flex items-center justify-between gap-3 py-2.5"><Link className="min-w-0 truncate font-semibold hover:underline" href={x.kind === "project" ? `/projects/${x.id}` : "/"}>{x.label}</Link><span className="shrink-0 text-sm text-ink/70">{fmtDate(new Date(`${x.k}T12:00:00Z`))}</span></li>)}</ul>}
          </Panel>
        </aside>
      </div>
    </>
  );
}
