import Link from "next/link";
import { requireStaff } from "@/modules/identity/session";
import { db } from "@/lib/db";
import { TicketCreateForm } from "@/components/ticket-create-form";
import { RecordHeader } from "@/components/ui";

export const metadata = { title: "New ticket" };

/** Step 1: which company. Step 2: what kind of ticket, who got in touch, and the details that kind needs. */
export default async function NewTicket({ searchParams }: { searchParams: Promise<{ business?: string; type?: string }> }) {
  const ctx = await requireStaff("customer.write");
  const sp = await searchParams;
  const companies = await db.customer.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { displayName: "asc" }, select: { id: true, displayName: true, reference: true }, take: 500 });
  const biz = companies.find((b) => b.id === sp.business);
  const [people, team] = biz ? await Promise.all([
    db.contact.findMany({ where: { customerId: biz.id }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }], select: { id: true, name: true, position: true } }),
    db.staffMembership.findMany({ where: { workspaceId: ctx.workspaceId, status: "active" }, orderBy: { displayName: "asc" }, select: { id: true, displayName: true } }),
  ]) : [[], []];
  return (
    <>
      <RecordHeader back={{ href: "/tickets", label: "Tickets" }} title="New ticket" meta={biz ? biz.displayName : "Start by choosing the company"} />
      {!biz ? (
        <div className="max-w-xl space-y-6">
          <form className="space-y-3"><label className="label" htmlFor="b">Which company is this for?</label>
            <select id="b" name="business" className="field" required defaultValue="">{<option value="" disabled>Choose a company</option>}{companies.map((b) => <option key={b.id} value={b.id}>{b.displayName} ({b.reference})</option>)}</select>
            <button className="btn">Continue</button></form>
          <p className="rounded-xl bg-bone px-4 py-3 text-sm">New customer? <Link className="font-semibold underline" href="/customers/new">Add the company first</Link>. It only takes a minute, and you can start the ticket straight after.</p>
        </div>
      ) : (
        <>
          <p className="mb-6 text-sm"><Link className="underline" href="/tickets/new">Change company</Link></p>
          <TicketCreateForm customer={{ id: biz.id, name: biz.displayName }} people={people} team={team.map((m) => ({ id: m.id, name: m.displayName }))} me={ctx.staffId} initialType={sp.type} />
        </>
      )}
    </>
  );
}
