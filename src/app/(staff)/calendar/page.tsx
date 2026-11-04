import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Clock, FolderKanban, CheckSquare, Download, X, MapPin, Video, Building2 } from "lucide-react";
import { db } from "@/lib/db";
import { can } from "@/modules/identity/permissions";
import { requireStaff } from "@/modules/identity/session";
import { listEvents } from "@/modules/calendar/service";
import { cancelEventAction } from "@/app/actions/work";
import { AddEventDialog, type EditEvent } from "@/components/add-event-dialog";

export const metadata = { title: "Calendar" };

const TZ = "Europe/London";
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
const timeOf = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const iso = (d: Date) => d.toISOString().slice(0, 10);
const noon = (k: string) => new Date(`${k}T12:00:00Z`);
const addDays = (k: string, n: number) => iso(new Date(noon(k).getTime() + n * 864e5));
const mondayOf = (k: string) => addDays(k, -((noon(k).getUTCDay() + 6) % 7));
const fmt = (k: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...o, timeZone: "UTC" }).format(noon(k));
const isUrl = (s: string | null) => !!s && /^https?:\/\//i.test(s);

/** One calm colour per kind of event, so a glance tells you what the day is. */
const KIND: Record<string, { label: string; bar: string; chip: string }> = {
  client_call: { label: "Customer call", bar: "bg-[#0c6a49]", chip: "bg-[#dff5ea] text-[#0a5a3d]" },
  review: { label: "Review", bar: "bg-[#d98a00]", chip: "bg-[#fdeccb] text-[#7a4a00]" },
  focus: { label: "Focus", bar: "bg-[#8a8a93]", chip: "bg-[#f1f1f3] text-[#3f3f46]" },
  internal_meeting: { label: "Team meeting", bar: "bg-[#18181b]", chip: "bg-[#e9e9ec] text-[#18181b]" },
  other: { label: "Event", bar: "bg-[#52525b]", chip: "bg-[#f1f1f3] text-[#3f3f46]" },
};
const kind = (t: string) => KIND[t] ?? KIND.other;

type Mark = { kind: "project" | "task"; id: string; label: string; sub?: string };

export default async function Calendar({ searchParams }: { searchParams: Promise<{ scope?: string; error?: string; day?: string; view?: string; add?: string; added?: string; edit?: string; updated?: string }> }) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const scope = sp.scope === "team" ? "team" : "mine";
  const view = sp.view === "month" ? "month" : "week";
  const today = dayKey(new Date());
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(sp.day ?? "") ? sp.day! : today;
  const m = selected.slice(0, 7);
  const [y, mo] = m.split("-").map(Number);
  const gridStart = mondayOf(`${m}-01`);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const weekStart = mondayOf(selected);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const from = noon(gridStart), to = noon(addDays(gridStart, 43));
  const [events, dueProjects, dueTasks] = await Promise.all([
    listEvents(ctx, new Date(from.getTime() - 864e5), to, scope),
    db.project.findMany({ where: { workspaceId: ctx.workspaceId, dueDate: { gte: from, lt: to }, stage: { notIn: ["completed", "cancelled"] } }, select: { id: true, name: true, dueDate: true, customer: { select: { displayName: true } } } }),
    db.task.findMany({ where: { workspaceId: ctx.workspaceId, assigneeId: ctx.staffId, doneAt: null, dueDate: { gte: from, lt: to } }, select: { id: true, title: true, dueDate: true } }),
  ]);
  const custIds = [...new Set(events.map((e) => e.customerId).filter((x): x is string => !!x))];
  const [custs, companies] = await Promise.all([
    custIds.length ? db.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, displayName: true } }) : Promise.resolve([]),
    db.customer.findMany({ where: { workspaceId: ctx.workspaceId, archivedAt: null }, orderBy: { displayName: "asc" }, take: 200, select: { id: true, displayName: true } }),
  ]);
  const custName = new Map(custs.map((c) => [c.id, c.displayName]));

  const marks = new Map<string, Mark[]>();
  for (const p of dueProjects) if (p.dueDate) marks.set(iso(p.dueDate), [...(marks.get(iso(p.dueDate)) ?? []), { kind: "project", id: p.id, label: p.name, sub: p.customer?.displayName }]);
  for (const t of dueTasks) if (t.dueDate) marks.set(iso(t.dueDate), [...(marks.get(iso(t.dueDate)) ?? []), { kind: "task", id: t.id, label: t.title }]);
  const byDay = new Map<string, typeof events>();
  for (const e of events) { const k = dayKey(e.startsAt); byDay.set(k, [...(byDay.get(k) ?? []), e]); }

  const canWrite = can(ctx.role, "calendar.write");
  const q = (o: { day?: string; view?: string; add?: boolean; edit?: string }) => {
    const p = new URLSearchParams(); if (scope === "team") p.set("scope", "team");
    p.set("view", o.view ?? view); p.set("day", o.day ?? selected); if (o.add) p.set("add", "1"); if (o.edit) p.set("edit", o.edit);
    return `/calendar?${p}`;
  };
  const here = q({});
  const monthShift = (n: number) => { const d = utc(y, mo - 1 + n, 1); return iso(d); };
  const prev = view === "month" ? monthShift(-1) : addDays(selected, -7), next = view === "month" ? monthShift(1) : addDays(selected, 7);
  const title = view === "month" ? fmt(selected, { month: "long", year: "numeric" }) : `${fmt(week[0], { day: "numeric", month: "short" })} – ${fmt(week[6], { day: "numeric", month: "short" })}`;

  const dayEvents = byDay.get(selected) ?? [];
  const dayMarks = marks.get(selected) ?? [];
  const now = new Date();
  const upcoming = events.filter((e) => e.status === "scheduled" && e.endsAt >= now).slice(0, 4);
  const dueSoon = [...marks.entries()].filter(([k]) => k >= today).sort(([a], [b]) => a.localeCompare(b)).flatMap(([k, list]) => list.map((x) => ({ ...x, k }))).slice(0, 5);

  const Dots = ({ k, light }: { k: string; light?: boolean }) => {
    const ev = (byDay.get(k) ?? []).filter((e) => e.status !== "cancelled"), mk = marks.get(k) ?? [];
    return <span className="flex h-2 items-center justify-center gap-0.5" aria-hidden>{ev.slice(0, 3).map((e) => <i key={e.id} className={`size-1.5 rounded-full ${light ? "bg-white/80" : kind(e.type).bar}`} />)}{mk.slice(0, 2).map((x) => <i key={x.id} className={`size-1.5 rounded-full ${light ? "bg-white/80" : x.kind === "project" ? "bg-[#d98a00]" : "bg-[#0c6a49]"}`} />)}</span>;
  };

  const EventCard = ({ e }: { e: (typeof events)[number] }) => {
    const kd = kind(e.type), cancelled = e.status === "cancelled", past = e.endsAt < now && !cancelled, who = e.customerId ? custName.get(e.customerId) : undefined;
    const allDay = e.endsAt.getTime() - e.startsAt.getTime() >= 23 * 3600e3;
    return (
      <li className={`flex gap-3 rounded-xl border border-[var(--card-line)] bg-white p-3 ${past ? "opacity-60" : ""}`}>
        <span className={`w-1 shrink-0 rounded-full ${cancelled ? "bg-[#d4d4d8]" : kd.bar}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-[13px] font-semibold text-muted"><Clock size={13} aria-hidden />{allDay ? "All day" : `${timeOf(e.startsAt)} – ${timeOf(e.endsAt)}`}<span className={`rounded-md px-1.5 py-0.5 text-[11.5px] ${kd.chip}`}>{kd.label}</span>{cancelled && <span className="rounded-md bg-[#fdecea] px-1.5 py-0.5 text-[11.5px] text-[#a12a1f]">Cancelled</span>}</p>
          <p className={`mt-1 break-words text-[16px] font-bold leading-snug ${cancelled ? "line-through" : ""}`}>{e.title}</p>
          {who && <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted"><Building2 size={13} aria-hidden />{who}</p>}
          {e.location && (isUrl(e.location)
            ? <a href={e.location} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#18181b] px-3 text-sm font-semibold text-white"><Video size={14} aria-hidden />Join meeting</a>
            : <p className="mt-0.5 flex items-start gap-1.5 break-words text-sm text-muted"><MapPin size={13} className="mt-0.5 shrink-0" aria-hidden />{e.location}</p>)}
          {!cancelled && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <a className="btn btn-quiet !min-h-10 text-[13px] sm:!min-h-8" href={`/calendar/${e.id}/ics`}><Download size={13} aria-hidden /> Add to my calendar</a>
              {canWrite && e.status === "scheduled" && <Link href={q({ day: dayKey(e.startsAt), edit: e.id })} replace scroll={false} className="btn btn-quiet !min-h-10 text-[13px] sm:!min-h-8">Edit</Link>}
              {canWrite && e.status === "scheduled" && <form action={cancelEventAction}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="version" value={e.version} /><input type="hidden" name="back" value={here} /><button className="btn btn-quiet !min-h-10 text-[13px] sm:!min-h-8"><X size={13} aria-hidden /> Cancel</button></form>}
            </div>
          )}
        </div>
      </li>
    );
  };

  const MarkRow = ({ x }: { x: Mark }) => (
    <li><Link href={x.kind === "project" ? `/projects/${x.id}` : "/"} className={`flex min-h-12 items-center gap-2.5 rounded-xl px-3 py-2 text-[15px] font-semibold ${x.kind === "project" ? "bg-[#fdeccb] text-[#7a4a00]" : "bg-[#dff5ea] text-[#0a5a3d]"}`}>
      {x.kind === "project" ? <FolderKanban size={16} aria-hidden /> : <CheckSquare size={16} aria-hidden />}
      <span className="min-w-0"><span className="block break-words">{x.label}</span><span className="block text-[12.5px] font-medium opacity-80">{x.kind === "project" ? `Project due${x.sub ? ` · ${x.sub}` : ""}` : "Your task is due"}</span></span>
    </Link></li>
  );

  const editing = sp.edit ? events.find((e) => e.id === sp.edit && e.status === "scheduled") : undefined;
  const editData: EditEvent | undefined = editing ? { id: editing.id, version: editing.version, title: editing.title, type: editing.type, date: dayKey(editing.startsAt), time: timeOf(editing.startsAt), minutes: Math.round((editing.endsAt.getTime() - editing.startsAt.getTime()) / 60000), allDay: editing.endsAt.getTime() - editing.startsAt.getTime() >= 23 * 3600e3, location: editing.location ?? "", customerId: editing.customerId ?? "" } : undefined;
  const isToday = selected === today;
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0"><h1 className="!text-2xl sm:!text-3xl">Calendar</h1><p className="mt-0.5 hidden text-sm text-muted sm:block">Meetings, project due dates and your tasks in one place.</p></div>
        <div className="flex items-center gap-2">
          <nav aria-label="Whose events" className="flex rounded-lg border border-[var(--card-line)] bg-white p-0.5">
            <Link className={`grid min-h-10 place-items-center rounded-md px-3 text-sm font-semibold sm:min-h-8 ${scope === "mine" ? "bg-[#18181b] text-white" : "text-muted"}`} href={`/calendar?view=${view}&day=${selected}`}>Mine</Link>
            <Link className={`grid min-h-10 place-items-center rounded-md px-3 text-sm font-semibold sm:min-h-8 ${scope === "team" ? "bg-[#18181b] text-white" : "text-muted"}`} href={`/calendar?scope=team&view=${view}&day=${selected}`}>Team</Link>
          </nav>
          {canWrite && <Link href={q({ add: true })} replace scroll={false} className="btn !min-h-10 sm:!min-h-9"><Plus size={16} aria-hidden /> Add<span className="max-sm:hidden"> event</span></Link>}
        </div>
      </div>
      {(sp.added || sp.updated) && <p role="status" className="mb-3 rounded-lg bg-[#dff5ea] px-3 py-2 text-sm font-semibold text-[#0a5a3d]">{sp.updated ? "Event updated." : "Event added."}</p>}
      {sp.error && !sp.add && !sp.edit && <p role="alert" className="mb-3 rounded-lg bg-[#fdecea] px-3 py-2 text-sm font-semibold text-[#a12a1f]">{sp.error}</p>}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          {/* Navigation bar */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Link aria-label={view === "month" ? "Previous month" : "Previous week"} className="btn btn-quiet !min-h-11 !w-11 !px-0 sm:!min-h-9 sm:!w-9" href={q({ day: prev })}><ChevronLeft size={18} /></Link>
              <h2 className="min-w-[8.5rem] text-center text-base font-bold sm:min-w-44 sm:text-lg">{title}</h2>
              <Link aria-label={view === "month" ? "Next month" : "Next week"} className="btn btn-quiet !min-h-11 !w-11 !px-0 sm:!min-h-9 sm:!w-9" href={q({ day: next })}><ChevronRight size={18} /></Link>
            </div>
            <div className="flex items-center gap-1.5">
              {!isToday && <Link className="btn btn-quiet !min-h-11 sm:!min-h-9" href={q({ day: today })}>Today</Link>}
              <nav aria-label="View" className="hidden rounded-lg border border-[var(--card-line)] bg-white p-0.5 lg:flex">
                <Link className={`grid min-h-8 place-items-center rounded-md px-3 text-sm font-semibold ${view === "week" ? "bg-[#18181b] text-white" : "text-muted"}`} href={q({ view: "week" })}>Week</Link>
                <Link className={`grid min-h-8 place-items-center rounded-md px-3 text-sm font-semibold ${view === "month" ? "bg-[#18181b] text-white" : "text-muted"}`} href={q({ view: "month" })}>Month</Link>
              </nav>
            </div>
          </div>

          {/* Phone + tablet: a week strip you can tap through */}
          <div className={`${view === "week" ? "" : ""} lg:hidden`}>
            <ol className="grid grid-cols-7 gap-1" aria-label="Days this week">
              {week.map((k) => { const sel = k === selected, td = k === today; return (
                <li key={k}><Link href={q({ day: k })} aria-current={td ? "date" : undefined} aria-label={fmt(k, { weekday: "long", day: "numeric", month: "long" })} className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-center ${sel ? "border-[#18181b] bg-[#18181b] text-white" : td ? "border-[#0c6a49] bg-[#f0faf5]" : "border-[var(--card-line)] bg-white"}`}>
                  <span className={`text-[11.5px] font-semibold ${sel ? "text-white/80" : "text-muted"}`}>{fmt(k, { weekday: "short" })}</span>
                  <span className="text-[17px] font-bold leading-none">{noon(k).getUTCDate()}</span>
                  <Dots k={k} light={sel} />
                </Link></li>); })}
            </ol>
          </div>

          {/* Desktop week: seven columns */}
          {view === "week" && (
            <section aria-label="Week" className="hidden overflow-hidden rounded-xl border border-[var(--card-line)] bg-white lg:block">
              <div className="grid grid-cols-7 divide-x divide-[var(--card-rule)]">
                {week.map((k) => { const ev = byDay.get(k) ?? [], mk = marks.get(k) ?? [], sel = k === selected, td = k === today; return (
                  <div key={k} className={`group relative flex min-h-[22rem] flex-col ${sel ? "bg-[#fafafa]" : ""}`}>
                    <Link href={q({ day: k })} className={`flex items-center justify-between border-b border-[var(--card-rule)] px-3 py-2.5 hover:bg-[#f4f4f5] ${sel ? "bg-[#f4f4f5]" : ""}`} aria-current={td ? "date" : undefined}>
                      <span className="text-[13px] font-semibold text-muted">{fmt(k, { weekday: "short" })}</span>
                      <span className={`grid h-7 min-w-7 place-items-center rounded-full px-1 text-[14px] font-bold ${td ? "bg-[#18181b] text-white" : ""}`}>{noon(k).getUTCDate()}</span>
                    </Link>
                    <ul className="flex-1 space-y-1.5 p-1.5">
                      {ev.slice(0, 4).map((e) => <li key={e.id}><Link href={q({ day: k })} className={`block rounded-lg px-2 py-1.5 text-[12.5px] font-semibold leading-snug ${kind(e.type).chip} ${e.status === "cancelled" ? "line-through opacity-60" : ""}`}><span className="block font-bold">{timeOf(e.startsAt)}</span><span className="line-clamp-2 break-words">{e.title}</span></Link></li>)}
                      {ev.length > 4 && <li><Link href={q({ day: k })} className="block px-2 py-1 text-[12.5px] font-semibold text-muted hover:underline">+{ev.length - 4} more</Link></li>}
                      {mk.map((x) => <li key={x.id}><Link href={x.kind === "project" ? `/projects/${x.id}` : "/"} className={`block rounded-lg px-2 py-1.5 text-[12.5px] font-semibold ${x.kind === "project" ? "bg-[#fdeccb] text-[#7a4a00]" : "bg-[#dff5ea] text-[#0a5a3d]"}`}><span className="line-clamp-2 break-words">{x.kind === "project" ? "Due: " : "Task: "}{x.label}</span></Link></li>)}
                    </ul>
                    {canWrite && <Link href={q({ day: k, add: true })} replace scroll={false} aria-label={`Add an event on ${fmt(k, { weekday: "long", day: "numeric", month: "long" })}`} className="absolute bottom-2 right-2 grid size-8 place-items-center rounded-lg bg-[#18181b] text-white opacity-0 shadow-sm transition-opacity focus:opacity-100 group-hover:opacity-100"><Plus size={15} aria-hidden /></Link>}
                  </div>); })}
              </div>
            </section>
          )}

          {/* Desktop month */}
          {view === "month" && (
            <section aria-label="Month" className="hidden overflow-hidden rounded-xl border border-[var(--card-line)] bg-white lg:block">
              <div className="grid grid-cols-7 border-b border-[var(--card-rule)] bg-[var(--card-head)] text-center text-[13px] font-bold text-muted">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-2">{d}</div>)}</div>
              <div className="grid grid-cols-7">
                {cells.map((k, i) => { const inMonth = k.slice(0, 7) === m, ev = byDay.get(k) ?? [], mk = marks.get(k) ?? [], td = k === today, sel = k === selected, total = ev.length + mk.length; return (
                  <div key={k} className={`group relative min-h-[6.5rem] border-[var(--card-rule)] p-1.5 ${i % 7 !== 6 ? "border-r" : ""} ${i < 35 ? "border-b" : ""} ${inMonth ? "" : "bg-[var(--color-soft)] text-muted"} ${sel ? "!bg-[#f4f4f5] ring-2 ring-inset ring-[#18181b]" : ""}`}>
                    <Link href={q({ day: k })} aria-label={`${fmt(k, { day: "numeric", month: "long" })}${total ? `, ${total} item${total > 1 ? "s" : ""}` : ""}`} aria-current={td ? "date" : undefined} className="absolute inset-0 hover:bg-[#18181b]/5" />
                    <span className={`pointer-events-none relative grid h-7 min-w-7 w-fit place-items-center rounded-full px-1 text-[13.5px] font-semibold ${td ? "bg-[#18181b] text-white" : ""}`}>{noon(k).getUTCDate()}</span>
                    <span className="pointer-events-none relative mt-1 flex flex-col gap-0.5">
                      {ev.slice(0, 2).map((e) => <span key={e.id} className={`truncate rounded-md px-1.5 py-0.5 text-[12px] font-semibold ${kind(e.type).chip} ${e.status === "cancelled" ? "line-through opacity-60" : ""}`}>{timeOf(e.startsAt)} {e.title}</span>)}
                      {mk.slice(0, Math.max(0, 3 - Math.min(ev.length, 2))).map((x) => <span key={x.id} className={`truncate rounded-md px-1.5 py-0.5 text-[12px] font-semibold ${x.kind === "project" ? "bg-[#fdeccb] text-[#7a4a00]" : "bg-[#dff5ea] text-[#0a5a3d]"}`}>{x.label}</span>)}
                      {total > 3 && <span className="px-1 text-[12px] font-semibold text-muted">+{total - 3} more</span>}
                    </span>
                    {canWrite && inMonth && <Link href={q({ day: k, add: true })} replace scroll={false} aria-label={`Add an event on ${fmt(k, { day: "numeric", month: "long" })}`} className="absolute right-1 top-1 z-10 grid size-7 place-items-center rounded-lg bg-[#18181b] text-white opacity-0 shadow-sm focus:opacity-100 group-hover:opacity-100"><Plus size={15} aria-hidden /></Link>}
                  </div>); })}
              </div>
            </section>
          )}

          {/* The selected day. On a phone this is the main content. */}
          <section aria-label={fmt(selected, { weekday: "long", day: "numeric", month: "long" })} className="lg:hidden">
            <h2 className="mb-2 flex items-center justify-between text-base font-bold">{isToday ? "Today" : fmt(selected, { weekday: "long" })}<span className="text-sm font-medium text-muted">{fmt(selected, { day: "numeric", month: "long" })}</span></h2>
            {dayEvents.length === 0 && dayMarks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--card-line)] bg-white px-4 py-8 text-center">
                <p className="font-semibold">Nothing planned</p>
                <p className="mt-1 text-sm text-muted">{isToday ? "A clear day." : "This day is free."}</p>
                {canWrite && <Link href={q({ add: true })} replace scroll={false} className="btn mt-4"><Plus size={16} aria-hidden /> Add an event</Link>}
              </div>
            ) : (
              <ul className="space-y-2">{dayMarks.map((x) => <MarkRow key={x.kind + x.id} x={x} />)}{dayEvents.map((e) => <EventCard key={e.id} e={e} />)}</ul>
            )}
          </section>
        </div>

        <aside className="hidden space-y-4 lg:block">
          <section className="rounded-xl border border-[var(--card-line)] bg-white p-4">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-bold">{isToday ? "Today" : fmt(selected, { weekday: "long" })}<span className="ml-2 text-sm font-medium text-muted">{fmt(selected, { day: "numeric", month: "long" })}</span></h2>{canWrite && <Link href={q({ add: true })} replace scroll={false} aria-label="Add an event on this day" className="btn btn-quiet !min-h-8 !w-8 !px-0"><Plus size={16} aria-hidden /></Link>}</div>
            {dayEvents.length === 0 && dayMarks.length === 0 ? <p className="text-sm text-muted">Nothing planned for this day.</p> : <ul className="space-y-2">{dayMarks.map((x) => <MarkRow key={x.kind + x.id} x={x} />)}{dayEvents.map((e) => <EventCard key={e.id} e={e} />)}</ul>}
          </section>
          <section className="rounded-xl border border-[var(--card-line)] bg-white p-4">
            <h2 className="mb-2 text-base font-bold">Next up</h2>
            {upcoming.length === 0 ? <p className="text-sm text-muted">Nothing coming up.</p> : <ul className="divide-y divide-[var(--card-rule)]">{upcoming.map((e) => <li key={e.id}><Link href={q({ day: dayKey(e.startsAt) })} className="flex items-center justify-between gap-3 py-2.5"><span className="min-w-0 truncate font-semibold">{e.title}</span><span className="shrink-0 text-sm text-muted">{new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ }).format(e.startsAt)} {timeOf(e.startsAt)}</span></Link></li>)}</ul>}
          </section>
          <section className="rounded-xl border border-[var(--card-line)] bg-white p-4">
            <h2 className="mb-2 text-base font-bold">Due soon</h2>
            {dueSoon.length === 0 ? <p className="text-sm text-muted">No project or task due dates coming up.</p> : <ul className="divide-y divide-[var(--card-rule)]">{dueSoon.map((x) => <li key={x.kind + x.id} className="flex items-center justify-between gap-3 py-2.5"><Link className="min-w-0 truncate font-semibold hover:underline" href={x.kind === "project" ? `/projects/${x.id}` : "/"}>{x.label}</Link><span className="shrink-0 text-sm text-muted">{fmt(x.k, { day: "numeric", month: "short" })}</span></li>)}</ul>}
          </section>
        </aside>
      </div>

      {canWrite && <AddEventDialog open={sp.add === "1" || !!editData} edit={editData} closeHref={here} day={selected} view={view} scope={scope} companies={companies.map((b) => ({ id: b.id, name: b.displayName }))} error={sp.add || sp.edit ? sp.error : undefined} />}
    </>
  );
}
