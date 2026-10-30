import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { can } from "@/modules/identity/permissions";
import { requireStaff } from "@/modules/identity/session";
import { listEvents } from "@/modules/calendar/service";
import { cancelEventAction, quickEventAction } from "@/app/actions/work";
import { RecordHeader, Status, Empty, ErrorSummary } from "@/components/ui";

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

  return (
    <>
      <RecordHeader title="Calendar" meta="Europe/London" action={<Link href="/calendar/new" className="btn">New event</Link>} />
      <ErrorSummary message={sp.error} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link aria-label="Previous month" className="btn btn-quiet h-10 w-10 !p-0" href={href({ month: shift(-1), day: undefined })}><ChevronLeft size={18} /></Link>
          <h2 className="min-w-40 text-center text-lg font-semibold">{title}</h2>
          <Link aria-label="Next month" className="btn btn-quiet h-10 w-10 !p-0" href={href({ month: shift(1), day: undefined })}><ChevronRight size={18} /></Link>
          <Link className="btn btn-quiet ml-2" href={href({ month: today.slice(0, 7), day: today })}>Today</Link>
        </div>
        <nav aria-label="Whose events" className="flex gap-2">
          <Link className={`btn ${scope === "mine" ? "" : "btn-quiet"}`} href={`/calendar?month=${m}&day=${selected}`}>Mine</Link>
          <Link className={`btn ${scope === "team" ? "" : "btn-quiet"}`} href={`/calendar?scope=team&month=${m}&day=${selected}`}>Team</Link>
        </nav>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line">
        <div className="grid grid-cols-7 border-b border-line bg-soft text-center text-xs font-medium text-muted">
          {DOW.map((d) => <div key={d} className="py-2"><span className="sm:hidden">{d[0]}</span><span className="hidden sm:inline">{d}</span></div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((c, i) => {
            const k = iso(c), inMonth = k.slice(0, 7) === m, list = byDay.get(k) ?? [], isToday = k === today, isSel = k === selected;
            return (
              <Link key={k} href={href({ day: k })} aria-label={`${k}${list.length ? `, ${list.length} event${list.length > 1 ? "s" : ""}` : ""}`} aria-current={isToday ? "date" : undefined}
                className={`relative flex min-h-14 flex-col gap-1 border-line p-1.5 text-sm hover:bg-soft sm:min-h-24 ${i % 7 !== 6 ? "border-r" : ""} ${i < 35 ? "border-b" : ""} ${inMonth ? "" : "bg-[#fbfbfb] text-muted"} ${isSel ? "bg-[#eef7f2]" : ""}`}>
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[13px] ${isToday ? "bg-moss font-semibold text-white" : ""}`}>{c.getUTCDate()}</span>
                <span className="flex flex-wrap gap-0.5 sm:hidden">{list.slice(0, 3).map((e) => <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${e.status === "cancelled" ? "bg-line" : "bg-moss"}`} />)}</span>
                <span className="hidden flex-col gap-0.5 sm:flex">
                  {list.slice(0, 3).map((e) => <span key={e.id} className={`truncate rounded bg-[#e3f2ea] px-1.5 py-0.5 text-xs text-moss ${e.status === "cancelled" ? "line-through opacity-60" : ""}`}>{timeOf(e.startsAt)} {e.title}</span>)}
                  {list.length > 3 && <span className="px-1 text-xs text-muted">+{list.length - 3} more</span>}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <section className="mt-6" aria-labelledby="day-h">
        <div className="mb-2 flex items-center justify-between"><h2 id="day-h" className="text-base">{selLabel}</h2></div>
        {dayEvents.length === 0 ? <Empty title="Nothing on this day"><Link className="underline" href="/calendar/new">Add an event</Link></Empty> : (
          <ul>{dayEvents.map((e) => (
            <li key={e.id} className="row flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0"><p className="text-sm text-muted">{timeOf(e.startsAt)} – {timeOf(e.endsAt)}</p><p className={`font-semibold break-words ${e.status === "cancelled" ? "line-through" : ""}`}>{e.title}</p>{e.location && <p className="text-sm break-all">{e.location}</p>}{e.status === "cancelled" && <Status label="cancelled" kind="bad" />}</div>
              <div className="flex gap-2"><a className="btn btn-quiet" href={`/calendar/${e.id}/ics`}>Add to calendar</a>
                {e.status === "scheduled" && <form action={cancelEventAction}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="version" value={e.version} /><button className="btn btn-quiet">Cancel event</button></form>}</div>
            </li>))}</ul>
        )}
        {can(ctx.role, "calendar.write") && (
          <form action={quickEventAction} className="mt-4 grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-[1fr_7.5rem_8rem] sm:items-end">
            <input type="hidden" name="date" value={selected} /><input type="hidden" name="month" value={m} />
            <div className="sm:col-span-3"><p className="text-sm font-semibold">Add to {selLabel}</p></div>
            <div><label className="label" htmlFor="qe-t">What is it?</label><input id="qe-t" name="title" className="field" placeholder="e.g. Call with Alex" required autoComplete="off" /></div>
            <div><label className="label" htmlFor="qe-s">Starts</label><input id="qe-s" name="time" type="time" className="field" defaultValue="09:00" required step={900} /></div>
            <div><label className="label" htmlFor="qe-d">Length</label>
              <select id="qe-d" name="minutes" className="field" defaultValue="60">{[[15, "15 min"], [30, "30 min"], [60, "1 hour"], [90, "1.5 hours"], [120, "2 hours"], [240, "Half a day"], [480, "All day"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="qe-l">Where? <span className="font-normal text-muted">(optional)</span></label><input id="qe-l" name="location" className="field" autoComplete="off" /></div>
            <button className="btn">Add event</button>
          </form>
        )}
        <p className="hint mt-3">Shows events created here, not external calendars.</p>
      </section>
    </>
  );
}
