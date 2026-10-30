import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { getCustomer, customerDetailsMissing } from "@/modules/crm/service";
import { createNoteAction } from "@/app/actions/work";
import { inviteClientAction } from "@/app/actions/crm";
import { db } from "@/lib/db";
import { RecordHeader, Status, Empty, ErrorSummary, Section, Stat, Tabs, money, fmtDateTime, timeAgo } from "@/components/ui";

export const metadata = { title: "Customer" };
const TABS = ["overview", "agreements", "projects", "notes", "activity"] as const;

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ invited?: string; error?: string; tab?: string; details?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const { id } = await params;
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as (typeof TABS)[number]) : "overview";
  const c = await getCustomer(ctx, id);
  if (!c) notFound();
  const [activity, notes] = await Promise.all([
    tab === "activity" ? db.auditEvent.findMany({ where: { workspaceId: ctx.workspaceId, customerId: id }, orderBy: { createdAt: "desc" }, take: 40 }) : [],
    db.note.findMany({ where: { workspaceId: ctx.workspaceId, customerId: id, archivedAt: null, OR: [{ visibility: "team" }, { ownerId: ctx.staffId }] }, orderBy: { updatedAt: "desc" }, take: 20 }),
  ]);
  const missing = customerDetailsMissing(c);
  const primary = c.contacts.find((x) => x.isPrimary) ?? c.contacts[0];
  const signedValue = c.contracts.filter((k) => k.status === "completed").reduce((n, k) => n + k.oneOffMinor, 0);
  const href = (t: string) => `/customers/${c.id}${t === "overview" ? "" : `?tab=${t}`}`;
  return (
    <>
      <RecordHeader avatar back={{ href: "/customers", label: "Customers" }} title={c.displayName}
        status={<><Status label={c.lifecycle} kind={c.lifecycle === "active" ? "good" : "neutral"} />{c.atRisk && <Status label="at risk" kind="bad" />}</>}
        meta={<span>{c.reference}</span>}
        action={<>
          {primary?.phone && <a className="btn btn-quiet" href={`tel:${primary.phone}`}>Call</a>}
          {primary?.email && <a className="btn btn-quiet" href={`mailto:${primary.email}`}>Email</a>}
          {can(ctx.role, "proposal.write") && <Link className="btn" href={`?new=ticket&customer=${c.id}`}>New ticket</Link>}
        </>} />
      <ErrorSummary message={sp.error} />
      {sp.invited && <p role="status" className="mb-6 rounded-lg bg-[#e9f6ef] px-4 py-3 text-sm text-[#0a5a3d]">Invitation sent.</p>}
      {sp.details && <p role="status" className="mb-6 rounded-lg bg-[#e9f6ef] px-4 py-3 text-sm text-[#0a5a3d]">Details saved.</p>}
      <Tabs current={tab} tabs={[
        { id: "overview", label: "Overview", href: href("overview") },
        { id: "agreements", label: "Tickets", href: href("agreements"), count: c.proposals.length + c.contracts.length },
        { id: "projects", label: "Projects", href: href("projects"), count: c.projects.length },
        { id: "notes", label: "Notes", href: href("notes"), count: notes.length },
        { id: "activity", label: "Activity", href: href("activity") },
      ]} />

      {tab === "overview" && (
        <>
          <div className="mb-10 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
            <Stat label="Tickets" value={c.proposals.length} href={href("agreements")} />
            <Stat label="Signed agreements" value={c.contracts.filter((k) => k.status === "completed").length} href={href("agreements")} />
            <Stat label="Signed value (one-off)" value={money(signedValue)} />
            <Stat label="Projects" value={c.projects.length} href={href("projects")} />
          </div>
          <div className="grid gap-x-16 gap-y-2 lg:grid-cols-2">
            <Section title="Contact" action={primary?.email && can(ctx.role, "customer.write") ? (
              <form action={inviteClientAction}><input type="hidden" name="customerId" value={c.id} /><input type="hidden" name="contactId" value={primary.id} /><button className="text-sm text-muted hover:text-ink">Invite to portal</button></form>
            ) : undefined}>
              {c.contacts.length === 0 ? <p className="text-sm text-muted">No contacts yet.</p> : c.contacts.map((p) => (
                <div key={p.id} className="row py-3"><p className="font-medium">{p.name}{p.isPrimary && <span className="ml-2 text-xs font-normal text-muted">primary</span>}</p>
                  <p className="text-sm text-muted break-all">{[p.email, p.phone].filter(Boolean).join(" · ") || "No details"}</p></div>
              ))}
            </Section>
            <Section title="Agreement details" action={can(ctx.role, "customer.write") ? <Link className="text-sm text-muted hover:text-ink" href={`/customers/${c.id}/details`}>{missing.length ? "Add details" : "Edit"}</Link> : undefined}>
              {missing.length ? <p className="rounded-lg bg-[#fff3da] px-4 py-3 text-sm text-[#5c3b00]">Missing: {missing.join(", ")}. Needed before an agreement can be sent.</p> : (
                <dl className="text-sm"><div className="row flex justify-between gap-4 py-2.5"><dt className="text-muted">Legal name</dt><dd className="text-right font-medium">{c.legalName}</dd></div>
                  <div className="row flex justify-between gap-4 py-2.5"><dt className="text-muted">Company number</dt><dd>{c.companyNumber ?? "None"}</dd></div>
                  <div className="row flex justify-between gap-4 py-2.5"><dt className="text-muted">Address</dt><dd className="text-right whitespace-pre-line">{c.billingAddress}</dd></div></dl>
              )}
            </Section>
          </div>
          <Section title="Opportunities">
            {c.opportunities.length === 0 ? <p className="text-sm text-muted">None.</p> : <ul>{c.opportunities.map((o) => <li key={o.id} className="row flex flex-wrap items-center justify-between gap-2 py-3"><span>{o.title}</span><span className="flex items-center gap-3 text-sm text-muted">{money(o.valueMinor, o.currency)}<Status label={o.stage} /></span></li>)}</ul>}
          </Section>
        </>
      )}

      {tab === "agreements" && (
        <Section title="Tickets and signed agreements">
          {c.proposals.length + c.contracts.length === 0 ? <Empty title="Nothing yet"><Link className="underline" href={`?new=ticket&customer=${c.id}`}>Create the first ticket</Link></Empty> : (
            <ul>
              {c.proposals.map((p) => <li key={p.id} className="row"><Link href={`/proposals/${p.id}`} className="flex min-h-14 items-center justify-between gap-3 py-3 hover:bg-soft sm:-mx-3 sm:rounded-lg sm:px-3"><span className="min-w-0"><span className="font-medium">{p.title}</span><span className="block text-sm text-muted">Proposal {p.reference}</span></span><Status label={p.status} kind={p.status === "accepted" ? "good" : "neutral"} /></Link></li>)}
              {c.contracts.map((k) => <li key={k.id} className="row"><Link href={`/contracts/${k.id}`} className="flex min-h-14 items-center justify-between gap-3 py-3 hover:bg-soft sm:-mx-3 sm:rounded-lg sm:px-3"><span className="min-w-0"><span className="font-medium">{k.title}</span><span className="block text-sm text-muted">Agreement {k.reference}</span></span><Status label={k.status.replace("_", " ")} kind={k.status === "completed" ? "good" : k.status === "voided" || k.status === "declined" ? "bad" : "warn"} /></Link></li>)}
            </ul>
          )}
        </Section>
      )}

      {tab === "projects" && (
        <Section title="Projects">
          {c.projects.length === 0 ? <Empty title="No projects yet">A project is created when an agreement is signed.</Empty> : <ul>{c.projects.map((p) => <li key={p.id} className="row"><Link href={`/projects/${p.id}`} className="flex min-h-14 items-center justify-between gap-3 py-3 hover:bg-soft sm:-mx-3 sm:rounded-lg sm:px-3"><span><span className="font-medium">{p.name}</span><span className="block text-sm text-muted">{p.reference}</span></span><Status label={p.stage} /></Link></li>)}</ul>}
        </Section>
      )}

      {tab === "notes" && (
        <Section title="Notes">
          {notes.length === 0 ? <p className="text-sm text-muted">No notes linked to this customer. Internal only.</p> : <ul>{notes.map((n) => <li key={n.id} className="row"><Link className="flex min-h-12 items-center justify-between py-3" href={`/notes/${n.id}`}>{n.title}<span className="text-sm text-muted">{timeAgo(n.updatedAt)}</span></Link></li>)}</ul>}
          {can(ctx.role, "notes.write") && <form action={createNoteAction} className="mt-4 flex max-w-lg flex-wrap gap-2"><input type="hidden" name="customerId" value={c.id} /><label className="sr-only" htmlFor="nn">Note title</label><input id="nn" name="title" className="field flex-1" placeholder="New note title" required /><button className="btn btn-quiet">Add note</button></form>}
        </Section>
      )}

      {tab === "activity" && (
        <Section title="Activity">
          {activity.length === 0 ? <p className="text-sm text-muted">No activity yet.</p> : <ul>{activity.map((a) => <li key={a.id} className="row flex flex-wrap justify-between gap-2 py-2.5 text-sm"><span>{a.actorLabel} <span className="text-muted">{a.action.replaceAll(".", " ").replaceAll("_", " ")}</span></span><span className="text-muted">{fmtDateTime(a.createdAt)}</span></li>)}</ul>}
        </Section>
      )}
    </>
  );
}
