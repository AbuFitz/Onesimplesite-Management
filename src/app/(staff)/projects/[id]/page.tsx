import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/modules/identity/session";
import { getProject, ALLOWED } from "@/modules/projects/service";
import { transitionAction, updateAction, assetAction, taskAction } from "@/app/actions/work";
import { RecordHeader, Status, ErrorSummary, fmtDate, fmtDateTime } from "@/components/ui";

export const metadata = { title: "Project" };
export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const ctx = await requireStaff();
  const { id } = await params;
  const { error } = await searchParams;
  const p = await getProject(ctx, id);
  if (!p) notFound();
  const missing = p.assetRequests.filter((a) => !a.receivedAt);
  return (
    <>
      <RecordHeader back={{ href: "/projects", label: "Projects" }} title={p.name} status={<Status label={p.stage} />}
        meta={<Link className="underline" href={`/customers/${p.customerId}`}>{p.customer.displayName}</Link>} />
      <ErrorSummary message={error} />
      {missing.length > 0 && <p className="mb-6 border-l-4 border-warn bg-wash px-3 py-2 text-sm"><strong>Waiting on client:</strong> {missing.map((a) => a.label).join(", ")}</p>}
      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="stage">
          <h2 id="stage" className="mb-2">Stage</h2>
          <form action={transitionAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={p.id} /><input type="hidden" name="version" value={p.version} />
            <div><label className="label" htmlFor="stage-sel">Move to</label>
              <select id="stage-sel" name="stage" className="field w-auto">{ALLOWED[p.stage].map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select></div>
            <button className="btn" disabled={ALLOWED[p.stage].length === 0}>Change stage</button>
          </form>
          <h2 className="mt-8 mb-2">Tasks</h2>
          <ul>{p.tasks.map((t) => <li key={t.id} className="row py-2 flex justify-between"><span>{t.title}</span><span className="text-sm text-muted">{fmtDate(t.dueDate)}</span></li>)}</ul>
          <form action={taskAction} className="mt-2 flex flex-wrap gap-2"><input type="hidden" name="id" value={p.id} />
            <label className="sr-only" htmlFor="tt">Task title</label><input id="tt" name="title" className="field flex-1 min-w-48" placeholder="New task" required />
            <label className="sr-only" htmlFor="td">Due</label><input id="td" name="dueDate" type="date" className="field w-auto" />
            <button className="btn btn-quiet">Add task</button></form>
        </section>
        <section aria-labelledby="assets">
          <h2 id="assets" className="mb-2">Client assets</h2>
          <ul>{p.assetRequests.map((a) => <li key={a.id} className="row py-2 flex justify-between gap-3"><span>{a.label}{a.required ? "" : " (optional)"}</span><Status label={a.receivedAt ? "received" : "requested"} kind={a.receivedAt ? "good" : "warn"} /></li>)}</ul>
          <form action={assetAction} className="mt-2 flex flex-wrap items-end gap-2"><input type="hidden" name="id" value={p.id} />
            <div className="flex-1 min-w-48"><label className="label" htmlFor="al">Request</label><input id="al" name="label" className="field" placeholder="Logo, copy, photos…" required /></div>
            <label className="flex items-center gap-2 min-h-11 text-sm"><input type="checkbox" name="required" defaultChecked /> Required</label>
            <button className="btn btn-quiet">Request asset</button></form>
          <p className="hint mt-1">Never ask for passwords here.</p>
        </section>
      </div>
      <section aria-labelledby="upd" className="mt-10 max-w-2xl">
        <h2 id="upd" className="mb-2">Updates</h2>
        <form action={updateAction} className="space-y-2 mb-6"><input type="hidden" name="id" value={p.id} />
          <label className="label" htmlFor="body">New update</label><textarea id="body" name="body" className="field" required />
          <label className="flex items-center gap-2 min-h-11 text-sm"><input type="checkbox" name="clientVisible" /> Visible to the client (otherwise internal)</label>
          <button className="btn">Post update</button></form>
        <ul>{p.updates.map((u) => <li key={u.id} className="row py-3"><p className="text-xs text-muted">{fmtDateTime(u.createdAt)} · <Status label={u.clientVisible ? "client visible" : "internal"} kind={u.clientVisible ? "warn" : "neutral"} /></p><p className="whitespace-pre-wrap">{u.body}</p></li>)}</ul>
      </section>
    </>
  );
}
