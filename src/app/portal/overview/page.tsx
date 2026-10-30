import Link from "next/link";
import { requireClient } from "@/modules/identity/session";
import { activeAccount, clientOverview, STAGE_COPY } from "@/modules/portal/service";
import { Section, Status, fmtDate, timeAgo } from "@/components/ui";

export const metadata = { title: "Overview" };
export default async function PortalOverview() {
  const c = await requireClient();
  const a = activeAccount(c);
  const o = await clientOverview(c);
  const current = o.projects.find((p) => !["completed", "cancelled"].includes(p.stage));
  const mine = current ? o.assets.filter((x) => x.projectId === current.id) : [];
  return (
    <>
      <h1 className="mb-1">Hello, {a.customer.displayName}</h1>
      <p className="mb-10 text-muted">{current ? STAGE_COPY[current.stage] : "Everything is up to date."}</p>

      {mine.length > 0 && (
        <Section title="What we need from you">
          <ul>{mine.map((x) => <li key={x.id} className="row flex flex-wrap items-center justify-between gap-2 py-3"><span>{x.label}{x.dueDate ? <span className="text-sm text-muted"> · by {fmtDate(x.dueDate)}</span> : null}</span><Status label={x.required ? "needed" : "optional"} kind={x.required ? "warn" : "neutral"} /></li>)}</ul>
          <p className="hint mt-2">Send these to your project contact. Please never email passwords.</p>
        </Section>
      )}

      {current && (
        <Section title="Your project" action={<Link href={`/projects/${current.id}`} className="text-sm text-muted hover:text-ink">View details</Link>}>
          <div className="row flex flex-wrap items-center justify-between gap-2 py-3"><span className="font-medium">{current.name}</span><Status label={current.stage} kind="good" /></div>
        </Section>
      )}

      <Section title="Latest updates">
        {o.updates.length === 0 ? <p className="text-sm text-muted">No updates yet. We'll post progress here.</p> : <ul>{o.updates.map((u) => <li key={u.id} className="row py-3"><p className="text-xs text-muted">{timeAgo(u.createdAt)}</p><p className="whitespace-pre-wrap">{u.body}</p></li>)}</ul>}
      </Section>

      {o.documents.length > 0 && (
        <Section title="Recent documents" action={<Link href="/documents" className="text-sm text-muted hover:text-ink">All documents</Link>}>
          <ul>{o.documents.map((d) => <li key={d.id} className="row flex flex-wrap items-center justify-between gap-2 py-3"><span><span className="font-medium">{d.title}</span><span className="block text-sm text-muted">{d.reference} · signed {d.completedAt && fmtDate(d.completedAt)}</span></span><a className="btn btn-quiet" href={`/documents/${d.id}/pdf`}>Download PDF</a></li>)}</ul>
        </Section>
      )}
    </>
  );
}
