import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { getCustomer } from "@/modules/crm/service";
import { db } from "@/lib/db";
import { createNoteAction } from "@/app/actions/work";
import { RecordHeader, Status, Empty, money, fmtDateTime } from "@/components/ui";

export const metadata = { title: "Customer" };
export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaff("customer.read");
  const { id } = await params;
  const c = await getCustomer(ctx, id);
  if (!c) notFound();
  const [activity, notes] = await Promise.all([
    db.auditEvent.findMany({ where: { workspaceId: ctx.workspaceId, customerId: id }, orderBy: { createdAt: "desc" }, take: 15 }),
    db.note.findMany({ where: { workspaceId: ctx.workspaceId, customerId: id, archivedAt: null, OR: [{ visibility: "team" }, { ownerId: ctx.staffId }] }, orderBy: { updatedAt: "desc" }, take: 5 }),
  ]);
  const primary = c.contacts.find((x) => x.isPrimary) ?? c.contacts[0];
  return (
    <>
      <RecordHeader back={{ href: "/customers", label: "Customers" }} title={c.displayName}
        status={<Status label={c.lifecycle} kind={c.lifecycle === "active" ? "good" : "neutral"} />}
        meta={<span>{c.reference}</span>}
        action={can(ctx.role, "proposal.write") && <Link className="btn" href={`/proposals/new?customer=${c.id}`}>New proposal</Link>} />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-8 min-w-0">
          <section aria-labelledby="work"><h2 id="work" className="mb-2">Work</h2>
            {c.proposals.length + c.contracts.length + c.projects.length === 0 ? <Empty title="No proposals, contracts or projects yet" /> : (
              <ul>
                {c.proposals.map((p) => <li key={p.id} className="row"><Link href={`/proposals/${p.id}`} className="flex justify-between gap-3 py-3 min-h-12"><span>Proposal {p.reference} · {p.title}</span><Status label={p.status} kind={p.status === "accepted" ? "good" : "neutral"} /></Link></li>)}
                {c.contracts.map((k) => <li key={k.id} className="row"><Link href={`/contracts/${k.id}`} className="flex justify-between gap-3 py-3 min-h-12"><span>Contract {k.reference} · {k.title}</span><Status label={k.status} kind={k.status === "completed" ? "good" : "warn"} /></Link></li>)}
                {c.projects.map((p) => <li key={p.id} className="row"><Link href={`/projects/${p.id}`} className="flex justify-between gap-3 py-3 min-h-12"><span>Project {p.reference} · {p.name}</span><Status label={p.stage} /></Link></li>)}
              </ul>
            )}
          </section>
          <section aria-labelledby="notes"><h2 id="notes" className="mb-2">Notes</h2>
            {notes.length === 0 ? <p className="text-sm text-muted">No linked notes. Internal only.</p> : <ul>{notes.map((n) => <li key={n.id} className="row"><Link className="block py-3 min-h-12" href={`/notes/${n.id}`}>{n.title}</Link></li>)}</ul>}
            <form action={createNoteAction} className="mt-2 flex flex-wrap gap-2"><input type="hidden" name="customerId" value={c.id} /><label className="sr-only" htmlFor="nn">Note title</label><input id="nn" name="title" className="field max-w-xs" placeholder="New note title" required /><button className="btn btn-quiet">Add note</button></form>
          </section>
          <section aria-labelledby="act"><h2 id="act" className="mb-2">Activity</h2>
            {activity.length === 0 ? <p className="text-sm text-muted">No activity yet.</p> : <ul>{activity.map((a) => <li key={a.id} className="row py-2 text-sm"><span className="text-muted">{fmtDateTime(a.createdAt)}</span> · {a.actorLabel} · {a.action.replaceAll(".", " ")}</li>)}</ul>}
          </section>
        </div>
        <aside aria-labelledby="ctx" className="space-y-4">
          <h2 id="ctx" className="sr-only">Contact and details</h2>
          {primary && (
            <div>
              <p className="label">Primary contact</p>
              <p>{primary.name}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {primary.phone && <a className="btn btn-quiet" href={`tel:${primary.phone}`}>Call</a>}
                {primary.email && <a className="btn btn-quiet" href={`mailto:${primary.email}`}>Email</a>}
              </div>
              {primary.email && <p className="hint mt-1 break-all">{primary.email}</p>}
            </div>
          )}
          <div><p className="label">Opportunities</p>
            {c.opportunities.map((o) => <p key={o.id} className="text-sm">{o.title} · <Status label={o.stage} /> · {money(o.valueMinor)}</p>)}
          </div>
        </aside>
      </div>
    </>
  );
}
