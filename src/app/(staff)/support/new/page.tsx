import Link from "next/link";
import { requireStaff } from "@/modules/identity/session";
import { db } from "@/lib/db";
import { supportCreateAction } from "@/app/actions/support";
import { TICKET_KINDS } from "@/modules/support/options";
import { RecordHeader, ErrorSummary } from "@/components/ui";

export const metadata = { title: "New support ticket" };

/** Two quick steps: pick the account, then say what it's about and who got in touch. */
export default async function NewSupport({ searchParams }: { searchParams: Promise<{ customerId?: string; error?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const sp = await searchParams;
  const customers = await db.customer.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { displayName: "asc" }, select: { id: true, displayName: true, reference: true }, take: 500 });
  const cust = customers.find((c) => c.id === sp.customerId);
  const [people, projects, team] = cust ? await Promise.all([
    db.contact.findMany({ where: { customerId: cust.id }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }], select: { id: true, name: true, position: true } }),
    db.project.findMany({ where: { customerId: cust.id }, select: { id: true, name: true } }),
    db.staffMembership.findMany({ where: { workspaceId: ctx.workspaceId, status: "active" }, select: { id: true, displayName: true } }),
  ]) : [[], [], []];
  return (
    <>
      <RecordHeader back={{ href: "/support", label: "Support tickets" }} title="New support ticket" meta="For when a customer rings, messages or emails you" />
      <ErrorSummary message={sp.error} />
      {!cust ? (
        <form className="max-w-lg space-y-4"><div><label className="label" htmlFor="c">Which account is it for?</label><select id="c" name="customerId" className="field" required defaultValue=""><option value="" disabled>Choose an account</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.displayName} ({c.reference})</option>)}</select></div><button className="btn">Continue</button><p className="hint">Not on the list? <Link className="underline" href="/customers">Add the business first</Link>.</p></form>
      ) : (
        <form action={supportCreateAction} className="max-w-xl space-y-4">
          <input type="hidden" name="customerId" value={cust.id} />
          <p className="rounded-xl bg-bone px-4 py-3 font-semibold">{cust.displayName} <Link className="ml-2 text-sm font-normal underline" href="/support/new">Change</Link></p>
          <div><label className="label" htmlFor="p">Who got in touch?</label><select id="p" name="contactId" className="field" defaultValue={people[0]?.id ?? ""}><option value="">Not sure</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.position ? `, ${p.position}` : ""}</option>)}</select></div>
          <div><label className="label" htmlFor="k">What is it?</label><select id="k" name="kind" className="field" defaultValue="issue">{TICKET_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></div>
          <div><label className="label" htmlFor="t">Short title</label><input id="t" name="title" className="field" maxLength={140} required /></div>
          <div><label className="label" htmlFor="b">What happened?</label><textarea id="b" name="body" rows={5} className="field" required /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><label className="label" htmlFor="pr">Priority</label><select id="pr" name="priority" className="field" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
            <div><label className="label" htmlFor="pj">Website</label><select id="pj" name="projectId" className="field" defaultValue=""><option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><label className="label" htmlFor="as">Owner</label><select id="as" name="assigneeId" className="field" defaultValue={ctx.staffId}><option value="">Nobody yet</option>{team.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}</select></div>
          </div>
          <button className="btn">Create ticket</button>
        </form>
      )}
    </>
  );
}
