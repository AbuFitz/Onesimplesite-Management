import Link from "next/link";
import { MoreHorizontal, Pencil, Trash2, Archive } from "lucide-react";
import { notFound } from "next/navigation";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { getCustomer, customerDetailsMissing, LIFECYCLE, LIFECYCLE_KEYS, type LifecycleKey } from "@/modules/crm/service";
import { createNoteAction } from "@/app/actions/work";
import { deleteBusinessAction, setCompanyStatusAction, archiveCompanyAction } from "@/app/actions/crm";
import { db } from "@/lib/db";
import { PeoplePanel } from "@/components/people-panel";
import { listPeople, pendingRequests } from "@/modules/people/service";
import { staffBilling, plainStatus, KIND_LABEL, chargeOf, isMonthly } from "@/modules/billing/service";
import { STATUS_LABEL, CATEGORY_LABEL } from "@/modules/support/options";
import { LiveRefresh } from "@/components/live-refresh";
import { RecordHeader, Status, Empty, ErrorSummary, Section, Stat, Tabs, money, fmtDateTime, timeAgo } from "@/components/ui";

export const metadata = { title: "Company" };
const TABS = ["overview", "people", "agreements", "tickets", "projects", "notes", "activity"] as const;

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string; restored?: string; invited?: string; error?: string; tab?: string; details?: string; done?: string; delete?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const { id } = await params;
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as (typeof TABS)[number]) : "overview";
  const c = await getCustomer(ctx, id);
  if (!c) notFound();
  const [people, requests] = tab === "people" || tab === "overview" ? await Promise.all([listPeople(ctx, id), pendingRequests(ctx, id)]) : [[], []];
  const [tickets, billing] = await Promise.all([db.ticket.findMany({ where: { customerId: id, workspaceId: ctx.workspaceId }, orderBy: { updatedAt: "desc" }, take: 50, include: { contact: { select: { name: true } } } }), staffBilling(ctx, id)]);
  const [activity, notes] = await Promise.all([
    tab === "activity" ? db.auditEvent.findMany({ where: { workspaceId: ctx.workspaceId, customerId: id }, orderBy: { createdAt: "desc" }, take: 40 }) : [],
    db.note.findMany({ where: { workspaceId: ctx.workspaceId, customerId: id, archivedAt: null, OR: [{ visibility: "team" }, { ownerId: ctx.staffId }] }, orderBy: { updatedAt: "desc" }, take: 20 }),
  ]);
  const missing = customerDetailsMissing(c);
  const primary = c.contacts.find((x) => x.isPrimary) ?? c.contacts[0];
  const signedValue = c.contracts.filter((k) => k.status === "completed").reduce((n, k) => n + k.oneOffMinor, 0);
  const unsignedProposals = c.proposals.filter((p) => !c.contracts.some((k) => k.proposalVersion?.proposalId === p.id));
  const agreementCount = unsignedProposals.length + c.contracts.length;
  const href = (t: string) => `/customers/${c.id}${t === "overview" ? "" : `?tab=${t}`}`;
  return (
    <>
      <LiveRefresh seconds={20} />
      <RecordHeader avatar logoId={c.id} back={{ href: "/customers", label: "Companies" }} title={c.displayName}
        status={<><Status label={LIFECYCLE[c.lifecycle as LifecycleKey]?.label ?? c.lifecycle} kind={LIFECYCLE[c.lifecycle as LifecycleKey]?.kind ?? "neutral"} />{c.atRisk && <Status label="at risk" kind="bad" />}{c.archivedAt && <Status label="Archived" kind="neutral" />}</>}
        meta={<span>{c.reference}</span>}
        action={<>
          {primary?.phone && <a className="btn btn-quiet" href={`tel:${primary.phone}`}>Call</a>}
          {primary?.email && <a className="btn btn-quiet" href={`mailto:${primary.email}`}>Email</a>}
          {can(ctx.role, "proposal.write") && <><Link className="btn btn-quiet" href={`/tickets/new?business=${c.id}`}>New ticket</Link><Link className="btn" href={`/agreements/new?business=${c.id}`}>New agreement</Link></>}
          {can(ctx.role, "customer.write") && (
            <details className="relative">
              <summary className="btn btn-quiet cursor-pointer list-none">Status</summary>
              <form action={setCompanyStatusAction} className="absolute right-0 z-20 mt-1 w-[min(20rem,calc(100vw-2rem))] space-y-3 rounded-xl border border-line bg-white p-3 shadow-[0_8px_30px_rgba(14,19,17,.12)]">
                <input type="hidden" name="id" value={c.id} />
                <fieldset className="space-y-1.5"><legend className="mb-1 text-sm font-bold">Company status</legend>
                  {LIFECYCLE_KEYS.map((k) => (
                    <label key={k} className="flex min-h-11 cursor-pointer gap-3 rounded-lg border border-line p-2.5 text-sm has-[:checked]:border-ink has-[:checked]:bg-[#eef7f2]"><input type="radio" name="lifecycle" value={k} defaultChecked={c.lifecycle === k} className="mt-0.5 size-4 accent-[#0c6a49]" /><span><span className="block font-semibold">{LIFECYCLE[k].label}</span><span className="text-muted">{LIFECYCLE[k].help}</span></span></label>
                  ))}
                </fieldset>
                <label className="flex min-h-10 cursor-pointer items-start gap-3 text-sm"><input type="checkbox" name="atRisk" defaultChecked={c.atRisk} className="mt-0.5 size-4 accent-[#b3261e]" /><span><span className="block font-semibold">At risk</span><span className="text-muted">Flag them if they might leave or aren't happy.</span></span></label>
                <button className="btn w-full">Save status</button>
              </form>
            </details>
          )}
          {can(ctx.role, "customer.write") && (
            <details className="relative">
              <summary className="btn btn-quiet cursor-pointer list-none" aria-label="More actions"><MoreHorizontal size={16} aria-hidden /> More</summary>
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-line bg-white p-1 shadow-[0_8px_30px_rgba(14,19,17,.12)]">
                <Link className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm hover:bg-bone" href={`/customers/${c.id}/details`}><Pencil size={15} aria-hidden /> Edit company details</Link>
                {can(ctx.role, "customer.archive") && <form action={archiveCompanyAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="archive" value={c.archivedAt ? "0" : "1"} /><button className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-bone"><Archive size={15} aria-hidden /> {c.archivedAt ? "Restore from archive" : "Archive this company"}</button></form>}
                <Link className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-[#b3261e] hover:bg-[#fde6dc]" href={`/customers/${c.id}?delete=1`}><Trash2 size={15} aria-hidden /> Delete this company</Link>
              </div>
            </details>
          )}
        </>} />
      {c.archivedAt && <p role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-bone px-4 py-3 text-sm"><Archive size={16} aria-hidden /><span><strong>This company is archived.</strong> It's hidden from the everyday lists but nothing is lost, and it still counts in the overview.</span>{can(ctx.role, "customer.archive") && <form action={archiveCompanyAction} className="ml-auto"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="archive" value="0" /><button className="btn btn-quiet">Restore</button></form>}</p>}
      {sp.status === "saved" && <p role="status" className="mb-4 rounded-lg bg-[#e9f6ef] px-4 py-3 text-sm font-semibold text-[#0a5a3d]">Status saved.</p>}
      {sp.restored && <p role="status" className="mb-4 rounded-lg bg-[#e9f6ef] px-4 py-3 text-sm font-semibold text-[#0a5a3d]">Restored from the archive.</p>}
      {sp.delete && can(ctx.role, "customer.write") && (
        <form action={deleteBusinessAction} className="mb-6 max-w-2xl space-y-3 rounded-2xl border border-[#e8b4ad] bg-[#fdf1ef] p-5 text-sm">
          <input type="hidden" name="id" value={c.id} />
          <p className="text-base font-semibold text-[#7a2e12]">Delete {c.displayName}?</p>
          <p>This permanently deletes the company and everything under it: people and their portal logins, tickets and files, orders and signed agreements, projects, notes and calendar entries. It can't be undone and nothing is kept.</p>
          <div><label className="label" htmlFor="typed">Type <strong>{c.displayName}</strong> to confirm</label><input id="typed" name="typed" className="field" autoComplete="off" required /></div>
          <div className="flex gap-2"><button className="btn !border-[#b3261e] !bg-[#b3261e] !text-white">Delete for good</button><Link className="btn btn-quiet" href={`/customers/${c.id}`}>Cancel</Link></div>
        </form>
      )}
      <ErrorSummary message={sp.error} />
      {sp.invited && <p role="status" className="mb-6 rounded-lg bg-[#e9f6ef] px-4 py-3 text-sm text-[#0a5a3d]">Invitation sent.</p>}
      {sp.done && <p role="status" className="mb-6 rounded-lg bg-[#e9f6ef] px-4 py-3 text-sm text-[#0a5a3d]">{sp.done}</p>}
      {requests.length > 0 && tab !== "people" && <p role="status" className="mb-6 rounded-lg bg-[#fbf3d5] px-4 py-3 text-sm text-[#5c4700]">{requests.length} request{requests.length === 1 ? "" : "s"} to add someone to the portal. <Link className="font-semibold underline" href={href("people")}>Review</Link></p>}
      {sp.details && <p role="status" className="mb-6 rounded-lg bg-[#e9f6ef] px-4 py-3 text-sm text-[#0a5a3d]">Details saved.</p>}
      <Tabs current={tab} tabs={[
        { id: "overview", label: "Overview", href: href("overview") },
        { id: "people", label: "People", href: href("people"), count: requests.length || c.contacts.length },
        { id: "agreements", label: "Agreements", href: href("agreements"), count: agreementCount },
        { id: "tickets", label: "Tickets", href: href("tickets"), count: tickets.length },
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
            <Section title="People" action={<Link className="text-sm text-muted hover:text-ink" href={href("people")}>Manage</Link>}>
              {people.length === 0 ? <p className="text-sm text-muted">Nobody added yet. <Link className="underline" href={href("people")}>Add the first person</Link>.</p> : people.slice(0, 5).map((p) => (
                <div key={p.id} className="row flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="font-medium">{p.name}{p.isPrimary && <span className="ml-2 text-xs font-normal text-muted">main contact</span>}</p>
                  <p className="text-sm text-muted break-all">{[p.position, p.email, p.phone].filter(Boolean).join(" · ") || "No details"}</p></div>
                  <span className="shrink-0 text-xs text-muted">{p.access === "active" ? "Has portal access" : p.access === "invited" ? "Invited" : p.access === "revoked" ? "Access removed" : "No portal access"}</span></div>
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
          <Section title="Payments and plan" action={billing.length ? undefined : undefined}>
            {billing.length === 0 ? <p className="text-sm text-muted">Nothing to pay yet. Payments appear here once an order is signed.</p> : (
              <ul>{billing.map((b) => { const st = plainStatus(b.kind, b.status, b.cancelsAt, b.trialEndsAt); return (
                <li key={b.id} className="row flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"><span><strong>{b.description ?? KIND_LABEL[b.kind] ?? b.kind}</strong> <span className="text-muted">· {chargeOf(b).title}{b.paidAt ? ` · paid ${fmtDateTime(b.paidAt)}` : ""}</span></span>
                  <span className="flex items-center gap-2"><span className="font-semibold">{money(b.amountMinor, b.currency)}{isMonthly(b.kind) ? " / month" : ""}</span><span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${st.tone === "ok" ? "bg-[#e9f6ef] text-[#0a5a3d]" : st.tone === "warn" ? "bg-[#fde6dc] text-[#7a2e12]" : st.tone === "off" ? "bg-bone text-muted" : "bg-[#fbf3d5] text-[#5c4700]"}`}>{st.label}</span></span></li>); })}</ul>
            )}
          </Section>
        </>
      )}

      {tab === "people" && <PeoplePanel customerId={c.id} people={people} requests={requests} canEdit={can(ctx.role, "customer.write")} />}

      {tab === "agreements" && (
        <Section title="Agreements">
          {agreementCount === 0 ? <Empty title="No agreements yet"><Link className="underline" href={`/agreements/new?business=${c.id}`}>Start their agreement</Link></Empty> : (
            <ul>
              {unsignedProposals.map((p) => <li key={p.id} className="row"><Link href={`/proposals/${p.id}`} className="flex min-h-14 items-center justify-between gap-3 py-3 hover:bg-soft sm:-mx-3 sm:rounded-lg sm:px-3"><span className="min-w-0"><span className="font-medium">{p.title}</span><span className="block text-sm text-muted">Agreement {p.reference}</span></span><Status label={p.status === "draft" ? "being written" : p.status === "sent" ? "waiting for signature" : p.status} kind={p.status === "accepted" ? "good" : "neutral"} /></Link></li>)}
              {c.contracts.map((k) => <li key={k.id} className="row"><Link href={`/contracts/${k.id}`} className="flex min-h-14 items-center justify-between gap-3 py-3 hover:bg-soft sm:-mx-3 sm:rounded-lg sm:px-3"><span className="min-w-0"><span className="font-medium">{k.title}</span><span className="block text-sm text-muted">Agreement {k.reference}</span></span><Status label={k.status.replace("_", " ")} kind={k.status === "completed" ? "good" : k.status === "voided" || k.status === "declined" ? "bad" : "warn"} /></Link></li>)}
            </ul>
          )}
        </Section>
      )}


      {tab === "tickets" && (
        <Section title="Tickets">
          {tickets.length === 0 ? <Empty title="No tickets yet"><Link className="underline" href={`/tickets/new?business=${c.id}`}>Raise one</Link></Empty> : (
            <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
              {tickets.map((t) => { const st = STATUS_LABEL[t.status] ?? { label: t.status, kind: "neutral" as const }; return (
                <li key={t.id}><Link href={`/support/${t.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-bone/60"><span className="min-w-0"><span className="flex items-center gap-2"><span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${CATEGORY_LABEL[t.category]?.cls ?? ""}`}>{CATEGORY_LABEL[t.category]?.label ?? "Support"}</span><span className="truncate font-semibold">{t.title}</span></span><span className="text-sm text-muted">{t.reference}{t.contact ? ` · ${t.contact.name}` : ""} · {timeAgo(t.updatedAt)}{t.priceMinor ? ` · ${money(t.priceMinor)}` : ""}</span></span><Status label={st.label} kind={st.kind} /></Link></li>); })}
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
