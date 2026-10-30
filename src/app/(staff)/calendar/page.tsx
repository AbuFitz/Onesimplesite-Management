import Link from "next/link";
import { requireStaff } from "@/modules/identity/session";
import { listEvents } from "@/modules/calendar/service";
import { cancelEventAction } from "@/app/actions/work";
import { RecordHeader, Status, Empty, ErrorSummary, fmtDateTime } from "@/components/ui";

export const metadata = { title: "Calendar" };
export default async function Calendar({ searchParams }: { searchParams: Promise<{ scope?: string; error?: string; from?: string }> }) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const scope = sp.scope === "team" ? "team" : "mine";
  const from = sp.from ? new Date(sp.from) : new Date(new Date().setHours(0, 0, 0, 0));
  const to = new Date(from.getTime() + 14 * 864e5);
  const events = await listEvents(ctx, from, to, scope);
  return (
    <>
      <RecordHeader title="Calendar" meta="Agenda · next 14 days · Europe/London" action={<Link href="/calendar/new" className="btn">New event</Link>} />
      <ErrorSummary message={sp.error} />
      <nav aria-label="Whose events" className="mb-4 flex gap-2"><Link className={`btn ${scope === "mine" ? "" : "btn-quiet"}`} href="/calendar">Mine</Link><Link className={`btn ${scope === "team" ? "" : "btn-quiet"}`} href="/calendar?scope=team">Team</Link></nav>
      <p className="hint mb-3">Availability is only known for events created here, not external calendars.</p>
      {events.length === 0 ? <Empty title="No events in this period"><Link className="underline" href="/calendar/new">Add an event</Link></Empty> : (
        <ul>{events.map((e) => (
          <li key={e.id} className="row py-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><p className="text-sm text-muted">{fmtDateTime(e.startsAt)} – {fmtDateTime(e.endsAt)}</p><p className={`font-semibold break-words ${e.status === "cancelled" ? "line-through" : ""}`}>{e.title}</p>{e.location && <p className="text-sm break-all">{e.location}</p>}{e.status === "cancelled" && <Status label="cancelled" kind="bad" />}</div>
            <div className="flex gap-2"><a className="btn btn-quiet" href={`/calendar/${e.id}/ics`}>Add to calendar</a>
              {e.status === "scheduled" && <form action={cancelEventAction}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="version" value={e.version} /><button className="btn btn-quiet">Cancel event</button></form>}</div>
          </li>))}</ul>
      )}
    </>
  );
}
