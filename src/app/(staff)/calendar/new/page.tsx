import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { createEventAction } from "@/app/actions/work";
import { RecordHeader, ErrorSummary } from "@/components/ui";

export const metadata = { title: "New event" };
export default async function NewEvent({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ctx = await requireStaff("calendar.write");
  const [staff, customers] = await Promise.all([
    db.staffMembership.findMany({ where: { workspaceId: ctx.workspaceId, status: "active" } }),
    db.customer.findMany({ where: { workspaceId: ctx.workspaceId, archivedAt: null }, orderBy: { displayName: "asc" }, take: 200 }),
  ]);
  return (
    <>
      <RecordHeader back={{ href: "/calendar", label: "Calendar" }} title="New event" />
      <ErrorSummary message={(await searchParams).error} />
      <form action={createEventAction} className="max-w-xl space-y-4">
        <div><label className="label" htmlFor="title">Title</label><input id="title" name="title" className="field" required /></div>
        <div><label className="label" htmlFor="type">Type</label><select id="type" name="type" className="field"><option value="internal_meeting">Internal meeting</option><option value="client_call">Client call</option><option value="review">Review</option><option value="focus">Focus time</option><option value="other">Other</option></select></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="startsAt">Starts</label><input id="startsAt" name="startsAt" type="datetime-local" className="field" required /></div>
          <div><label className="label" htmlFor="endsAt">Ends</label><input id="endsAt" name="endsAt" type="datetime-local" className="field" required /></div>
        </div>
        <p className="hint">Times are in your browser’s timezone; display is Europe/London.</p>
        <div><label className="label" htmlFor="location">Location or meeting link</label><input id="location" name="location" className="field" /></div>
        <div><label className="label" htmlFor="customerId">Customer (optional)</label><select id="customerId" name="customerId" className="field"><option value="">None</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}</select></div>
        <fieldset><legend className="label">Internal attendees</legend>{staff.filter((s) => s.id !== ctx.staffId).map((s) => <label key={s.id} className="flex items-center gap-2 min-h-11"><input type="checkbox" name="attendee" value={s.id} /> {s.displayName}</label>)}</fieldset>
        <div><label className="label" htmlFor="description">Description</label><textarea id="description" name="description" className="field" /></div>
        <p className="hint">Saving does not send invitations. Use “Add to calendar” to download an ICS file.</p>
        <button className="btn">Save event</button>
      </form>
    </>
  );
}
