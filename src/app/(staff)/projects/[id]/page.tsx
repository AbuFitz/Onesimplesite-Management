import { ImageLink } from "@/components/lightbox";
import { Journey } from "@/components/journey";
import { Ring, CHART } from "@/components/charts";
import { describe } from "@/modules/activity/describe";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Check, ListChecks, Files as FilesIcon, Ticket, Package, Megaphone, Sparkles, MoreHorizontal, ArrowRight, Folder, Download, Eye, EyeOff, Trash2, Paperclip, CircleDot, Circle } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { getProject, STAGE_GUIDE, PROJECT_TYPES, typeOf } from "@/modules/projects/service";
import { projectFileList } from "@/modules/files/service";
import { STATUS_LABEL } from "@/modules/support/options";
import { transitionAction, updateAction, assetAction, taskAction } from "@/app/actions/work";
import { projectTypeAction, seedTasksAction, toggleTaskAction, receiveAssetAction, removeAssetAction, uploadProjectFilesAction, shareFileAction, deleteFileAction } from "@/app/actions/projects";
import { Timeline } from "@/components/timeline";
import { RecordHeader, Status, ErrorSummary, fmtDate, fmtDateTime, timeAgo } from "@/components/ui";
import { Panel } from "@/components/panel";
import { FilePicker } from "@/components/file-picker";
import { SubmitButton } from "@/components/submit-button";
import { LiveRefresh } from "@/components/live-refresh";

export const metadata = { title: "Project" };
const kb = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);
const EXTRA = "image/png,image/jpeg,image/gif,image/webp,application/pdf,application/zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,.docx,.xlsx,.pptx,.zip,.txt,.csv";

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; tab?: string }> }) {
  const ctx = await requireStaff();
  if (!can(ctx.role, "project.read_all") && !can(ctx.role, "project.read_assigned")) redirect("/denied");
  const { id } = await params;
  const sp = await searchParams; const { error } = sp;
  const p = await getProject(ctx, id);
  if (!p) notFound();
  const [events, contact] = await Promise.all([
    db.auditEvent.findMany({ where: { workspaceId: ctx.workspaceId, targetType: "project", targetId: p.id }, orderBy: { createdAt: "asc" }, take: 200 }),
    db.contact.findFirst({ where: { customerId: p.customerId }, orderBy: [{ isPrimary: "desc" }], select: { name: true, email: true, phone: true, position: true } }),
  ]);
  const [files, tickets, contract] = await Promise.all([
    projectFileList(p.id, true),
    db.ticket.findMany({ where: { projectId: p.id, workspaceId: ctx.workspaceId }, orderBy: { updatedAt: "desc" }, take: 8, select: { id: true, title: true, reference: true, status: true, category: true, updatedAt: true } }),
    p.contractId ? db.contract.findUnique({ where: { id: p.contractId }, select: { id: true, reference: true, title: true } }) : null,
  ]);
  const canWrite = can(ctx.role, "project.write");
  const guide = STAGE_GUIDE[p.stage];
  const tpl = typeOf(p.workType);
  const idx = tpl.stages.indexOf(p.stage);
  const next = idx >= 0 ? tpl.stages[idx + 1] : tpl.stages[0];
  const NAME: Record<string, string> = { completed: "Completed", held: "On hold", cancelled: "Cancelled" };
  const label = (s: string) => STAGE_GUIDE[s]?.label ?? NAME[s] ?? s.replaceAll("_", " ");
  const others = ["design", "development", "qa", "client_review", "ready_to_launch", "launched", "planned", "awaiting_assets", "completed", "held", "cancelled"].filter((s) => s !== p.stage && !tpl.stages.includes(s as never));
  const finished = p.stage === "completed" || p.stage === "cancelled";
  // When each stage was reached (from the project's own history), how long it has been in this one, and how far along it is overall.
  const entered = new Map<string, Date>([[tpl.stages[0], p.createdAt]]);
  for (const e of events) if (e.action === "project.stage") { const to = (e.detail as { to?: string } | null)?.to; if (to) entered.set(to, e.createdAt); }
  const short = (d?: Date) => (d ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }).format(d) : undefined);
  const daysIn = Math.max(0, Math.floor((Date.now() - +(entered.get(p.stage) ?? p.createdAt)) / 864e5));
  const stagePct = p.stage === "completed" ? 1 : idx >= 0 && tpl.stages.length > 1 ? idx / (tpl.stages.length - 1) : 0;
  const taskPct = p.tasks.length ? p.tasks.filter((t) => t.doneAt).length / p.tasks.length : null;
  const overall = Math.round((taskPct === null ? stagePct : stagePct * 0.6 + taskPct * 0.4) * 100);
  const openTasks = p.tasks.filter((t) => !t.doneAt), doneTasks = p.tasks.filter((t) => t.doneAt);
  const missing = p.assetRequests.filter((a) => !a.receivedAt);
  const folders = [...new Set(files.map((f) => f.folder ?? ""))].sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
  const btn = "btn btn-quiet !min-h-10 sm:!min-h-8 text-[13px]";
  return (
    <>
      <LiveRefresh seconds={90} />
      <ErrorSummary message={error} />
      <section className="pj-head" aria-label="Project">
        <p className="pj-meta">
          <Link href="/projects" className="pj-back">‹ Projects</Link>
          <Status label={label(p.stage)} kind={p.stage === "launched" || p.stage === "completed" ? "good" : p.stage === "held" || p.stage === "cancelled" ? "bad" : "neutral"} />
          <Link href={`/customers/${p.customerId}`}>{p.customer.displayName}</Link>
          {p.dueDate && <span>due {fmtDate(p.dueDate)}</span>}
          {contract && <Link href={`/contracts/${contract.id}`}>{contract.reference}</Link>}
        </p>
        <div className="pj-top"><h1 className="pj-title">{p.name}</h1><div className="pj-ring" title="Stage progress and tasks done, combined"><Ring value={overall / 100} size={72} thickness={9} color={p.stage === "completed" || p.stage === "launched" ? CHART.teal : CHART.green} label="" /></div></div>
        <Journey steps={tpl.stages.map((st, i) => ({ key: st, label: label(st), state: (idx > i) || p.stage === "completed" ? "done" : idx === i ? "cur" : "todo", date: short(entered.get(st)) }))} />
        {idx < 0 && <p className="pj-off">At “{label(p.stage)}”, which isn&apos;t one of this type&apos;s usual steps. That&apos;s fine.</p>}
        {(guide || p.stage === "held" || finished) && (
          <div className="pj-next" aria-label="What to do now">
            <p className="pj-now"><Sparkles size={16} aria-hidden /><span>{guide?.now ?? (p.stage === "held" ? "Paused. Move it back to a stage when the customer is ready." : "Finished. Reopen it if something comes up.")}</span></p>
            {canWrite && (
              <div className="pj-do">
                <form action={transitionAction} className="pj-go"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="version" value={p.version} /><input type="hidden" name="stage" value={next ?? others[0]} />
                  {finished && <><label className="sr-only" htmlFor="why">Why reopen</label><input id="why" name="reason" className="field !min-h-10 w-48" placeholder="Why reopen it?" required /></>}
                  <button className="btn">{finished ? "Reopen" : `Move to ${label(next ?? others[0])}`} <ArrowRight size={15} aria-hidden /></button></form>
                <details className="pj-more"><summary aria-label="More ways to move this project"><MoreHorizontal size={18} aria-hidden /></summary>
                  <div className="pj-menu">
                    <form action={seedTasksAction}><input type="hidden" name="id" value={p.id} /><SubmitButton className="pj-item" pendingText="Adding…">Add the usual tasks for this stage</SubmitButton></form>
                    <form action={transitionAction} className="pj-jump"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="version" value={p.version} />
                      <label htmlFor="stage-sel">Go to another stage</label>
                      <select id="stage-sel" name="stage" className="field !min-h-10" defaultValue={next ?? others[0]}>
                        <optgroup label="This project's stages">{tpl.stages.filter((st) => st !== p.stage).map((st) => <option key={st} value={st}>{label(st)}</option>)}</optgroup>
                        <optgroup label="Other">{others.map((st) => <option key={st} value={st}>{label(st)}</option>)}</optgroup>
                      </select>
                      {finished && <input name="reason" className="field !min-h-10" placeholder="Why reopen it?" required />}
                      <button className="btn btn-quiet">Move</button></form>
                  </div></details>
              </div>
            )}
          </div>
        )}
      </section>
      <div className="pj-stats">
        <Link href={`/projects/${p.id}?tab=work`} replace scroll={false}><span>Stage</span><b className="num">{idx >= 0 ? idx + 1 : "·"}<small>/{tpl.stages.length}</small></b><em>{daysIn === 0 ? "Started today" : `${daysIn} ${daysIn === 1 ? "day" : "days"} in ${label(p.stage)}`}</em></Link>
        <Link href={`/projects/${p.id}?tab=work`} replace scroll={false}><span>Tasks</span><b className="num">{doneTasks.length}<small>/{p.tasks.length}</small></b><em><i className="pj-bar" style={{ "--p": `${p.tasks.length ? Math.round((doneTasks.length / p.tasks.length) * 100) : 0}%` } as React.CSSProperties} /></em></Link>
        <Link href={`/projects/${p.id}?tab=customer`} replace scroll={false} className={missing.length ? "warn" : ""}><span>Waiting on customer</span><b className="num">{missing.length}</b><em>{missing.length ? "things we asked for" : "nothing outstanding"}</em></Link>
        <Link href={`/projects/${p.id}?tab=files`} replace scroll={false}><span>Files</span><b className="num">{files.length}</b><em>{files.filter((f) => !f.internal).length} shared</em></Link>
      </div>

      {(() => {
        const tab = ["overview", "work", "customer", "files", "activity"].includes(String(sp.tab)) ? String(sp.tab) : "overview";
        const href = (t: string) => `/projects/${p.id}?tab=${t}`;
        const waiting = p.assetRequests.filter((a) => !a.receivedAt).length;
        const items: [string, string, string | null][] = [["overview", "Overview", null], ["work", "Tasks", openTasks.length ? `${openTasks.length} open` : null], ["customer", "Customer", waiting ? `${waiting} waiting` : null], ["files", "Files", files.length ? String(files.length) : null], ["activity", "Activity", null]];
        return (
          <>
            <nav className="ptabs" aria-label="Project sections">
              {items.map(([id, label, note]) => <Link key={id} href={href(id)} replace scroll={false} aria-current={tab === id ? "page" : undefined}>{label}{note && <i>{note}</i>}</Link>)}
            </nav>
            <div className="space-y-5 max-w-5xl">
              {tab === "overview" && (
                <div className="pj-grid">
                  <div className="space-y-5 min-w-0">
                    <Panel title="Up next" icon={ListChecks} tone="green" action={<Link className="text-sm font-semibold text-moss" href={href("work")} replace scroll={false}>All tasks</Link>}>
                      {openTasks.length === 0 ? (
                        <div className="pj-empty"><p>{p.tasks.length ? "Every task is done." : "No tasks yet."}</p>{canWrite && <form action={seedTasksAction}><input type="hidden" name="id" value={p.id} /><SubmitButton className="btn btn-quiet" pendingText="Adding…">Add the usual tasks for {label(p.stage)}</SubmitButton></form>}</div>
                      ) : (
                        <ul className="divide-y divide-[var(--card-rule)]">{openTasks.slice(0, 5).map((t) => (
                          <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                            <form action={toggleTaskAction} className="flex min-w-0 items-center gap-3"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="taskId" value={t.id} /><input type="hidden" name="done" value="1" />
                              <button disabled={!canWrite} aria-label={`Mark “${t.title}” done`} className="grid size-6 shrink-0 place-items-center rounded-md border-2 border-[#8995b0] bg-white" />
                              <span className="min-w-0 break-words text-[15px] font-medium">{t.title}</span></form>
                            <span className="shrink-0 text-sm text-ink/65">{fmtDate(t.dueDate)}</span>
                          </li>))}</ul>
                      )}
                    </Panel>
                    <Panel title="Waiting on the customer" icon={Package} tone="amber" action={<Link className="text-sm font-semibold text-moss" href={href("customer")} replace scroll={false}>{canWrite ? "Ask for something" : "Open"}</Link>}>
                      {missing.length === 0 ? <p className="text-[15px] text-ink/70">Nothing outstanding.</p> : <ul className="divide-y divide-[var(--card-rule)]">{missing.map((a) => <li key={a.id} className="flex items-center justify-between gap-3 py-2.5"><span className="text-[15px] font-medium">{a.label}{a.required ? "" : " (optional)"}</span><Status label="requested" kind="warn" /></li>)}</ul>}
                    </Panel>
                    <Panel title="Latest update" icon={Megaphone} tone="lilac" action={<Link className="text-sm font-semibold text-moss" href={href("customer")} replace scroll={false}>All updates</Link>}>
                      {p.updates.length === 0 ? <p className="text-[15px] text-ink/70">No updates yet.</p> : <div><p className="whitespace-pre-wrap break-words text-[15px]">{p.updates[0].body}</p><p className="mt-1.5 text-[13px] text-ink/60">{timeAgo(p.updates[0].createdAt)}{p.updates[0].clientVisible ? " · shown to the customer" : " · team only"}</p></div>}
                    </Panel>
                  </div>
                  <aside className="space-y-5 min-w-0">
                    <Panel title="At a glance" icon={CircleDot} tone="neutral">
                      <dl className="pj-facts">
                        <div><dt>Customer</dt><dd><Link href={`/customers/${p.customerId}`}>{p.customer.displayName}</Link></dd></div>
                        {contact && <div><dt>Contact</dt><dd>{contact.name}{contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}{contact.phone && <a href={`tel:${contact.phone}`}>{contact.phone}</a>}</dd></div>}
                        {contract && <div><dt>Agreement</dt><dd><Link href={`/contracts/${contract.id}`}>{contract.reference}</Link></dd></div>}
                        <div><dt>Due</dt><dd>{p.dueDate ? fmtDate(p.dueDate) : "Not set"}</dd></div>
                        <div><dt>Type</dt><dd>{tpl.label}</dd></div>
                        <div><dt>Tickets</dt><dd>{tickets.filter((t) => !["resolved", "closed"].includes(t.status)).length} open · <Link href={href("customer")} replace scroll={false}>see all</Link></dd></div>
                      </dl>
                    </Panel>
                    <Panel title="Recent activity" icon={ListChecks} tone="neutral" action={<Link className="text-sm font-semibold text-moss" href={href("activity")} replace scroll={false}>History</Link>}>
                      {events.length === 0 ? <p className="text-[15px] text-ink/70">Nothing yet.</p> : <ul className="pj-recent">{[...events].reverse().slice(0, 5).map((e) => <li key={e.id}><span>{describe(e.action).text}</span><em>{timeAgo(e.createdAt)}</em></li>)}</ul>}
                    </Panel>
                  </aside>
                </div>
              )}
              {tab === "work" && (<>
          <Panel title="Checklist" icon={ListChecks} tone="green" action={<span className="text-sm font-semibold text-ink/65">{doneTasks.length} of {p.tasks.length} done</span>}>
            {p.tasks.length === 0 ? <p className="text-[15px] text-ink/70">No tasks yet. Add the usual ones for this stage above, or write your own.</p> : (
              <ul className="divide-y divide-[var(--card-rule)]">{[...openTasks, ...doneTasks].map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                  <form action={toggleTaskAction} className="flex min-w-0 items-center gap-3"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="taskId" value={t.id} /><input type="hidden" name="done" value={t.doneAt ? "0" : "1"} />
                    <button disabled={!canWrite} aria-label={t.doneAt ? `Mark “${t.title}” not done` : `Mark “${t.title}” done`} className={`grid size-6 shrink-0 place-items-center rounded-md border-2 ${t.doneAt ? "border-[#18181b] bg-[#18181b] text-white" : "border-[#8995b0] bg-white"}`}>{t.doneAt && <Check size={15} aria-hidden />}</button>
                    <span className={`min-w-0 break-words text-[15px] ${t.doneAt ? "text-ink/55 line-through" : "font-medium"}`}>{t.title}</span></form>
                  <span className="shrink-0 text-sm text-ink/65">{fmtDate(t.dueDate)}</span>
                </li>))}</ul>
            )}
            {canWrite && <form action={taskAction} className="mt-3 flex flex-wrap gap-2 border-t border-[var(--card-rule)] pt-3"><input type="hidden" name="id" value={p.id} />
              <label className="sr-only" htmlFor="tt">Task</label><input id="tt" name="title" className="field !min-h-10 min-w-48 flex-1" placeholder="Add your own task" required />
              <label className="sr-only" htmlFor="td">Due</label><input id="td" name="dueDate" type="date" className="field !min-h-10 w-auto" /><button className="btn btn-quiet">Add</button></form>}
          </Panel>
              </>)}
              {tab === "customer" && (<>
          <Panel title="What we need from the customer" icon={Package} tone="amber">
            {p.assetRequests.length === 0 ? <p className="text-[15px] text-ink/70">Nothing requested yet. Ask for the logo, photos or text they need to supply.</p> : (
              <ul className="divide-y divide-[var(--card-rule)]">{p.assetRequests.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5"><span className="min-w-0 text-[15px] font-medium">{a.label}{a.required ? "" : " (optional)"}{a.response && <span className="mt-1 block whitespace-pre-wrap break-words rounded-lg bg-[#f4f4f5] px-3 py-2 text-sm font-normal"><b>Customer wrote:</b> {a.response}</span>}</span>
                  <span className="flex items-center gap-2"><Status label={a.receivedAt ? "received" : "requested"} kind={a.receivedAt ? "good" : "warn"} />{canWrite && <form action={receiveAssetAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="assetId" value={a.id} /><input type="hidden" name="received" value={a.receivedAt ? "0" : "1"} /><button className={btn}>{a.receivedAt ? "Undo" : "Mark received"}</button></form>}{canWrite && <form action={removeAssetAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="assetId" value={a.id} /><button className={btn} aria-label={`Remove request ${a.label}`}>Remove</button></form>}</span></li>))}</ul>
            )}
            {canWrite && <form action={assetAction} className="mt-3 flex flex-wrap items-end gap-2 border-t border-[var(--card-rule)] pt-3"><input type="hidden" name="id" value={p.id} />
              <div className="min-w-48 flex-1"><label className="label" htmlFor="al">Ask for something</label><input id="al" name="label" className="field !min-h-10" placeholder="Logo, copy, photos…" required /></div>
              <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" name="required" defaultChecked className="size-4" /> Required</label><button className="btn btn-quiet">Request</button></form>}
            <p className="mt-2 text-[13px] text-ink/65">Never ask for passwords here.</p>
          </Panel>
          <Panel title="Updates" icon={Megaphone} tone="lilac">
            {canWrite && <form action={updateAction} className="mb-4 space-y-2 rounded-xl bg-[var(--color-soft)] p-3"><input type="hidden" name="id" value={p.id} />
              <label className="label" htmlFor="body">Write an update</label><textarea id="body" name="body" className="field" rows={3} required />
              <label className="flex min-h-9 items-center gap-2 text-sm font-medium"><input type="checkbox" name="clientVisible" className="size-4" /> Show it to the customer in their portal</label>
              <button className="btn">Post update</button></form>}
            {p.updates.length === 0 ? <p className="text-[15px] text-ink/70">No updates yet.</p> : <ul className="space-y-3">{p.updates.map((u) => <li key={u.id} className="rounded-xl border border-[var(--card-rule)] p-3"><p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-ink/65">{fmtDateTime(u.createdAt)}<Status label={u.clientVisible ? "customer can see" : "team only"} kind={u.clientVisible ? "warn" : "neutral"} /></p><p className="whitespace-pre-wrap text-[15px]">{u.body}</p></li>)}</ul>}
          </Panel>
          <Panel title="Tickets for this project" icon={Ticket} tone="rose" action={<Link className="text-sm font-semibold text-moss" href={`/tickets/new?business=${p.customerId}`}>New ticket</Link>}>
            {tickets.length === 0 ? <p className="text-[15px] text-ink/70">None. Anything a customer raises about this site shows here.</p> : <ul className="divide-y divide-[var(--card-rule)]">{tickets.map((t) => { const s = STATUS_LABEL[t.status] ?? { label: t.status, kind: "neutral" as const }; return <li key={t.id}><Link href={`/support/${t.id}`} className="flex items-center justify-between gap-2 py-2.5"><span className="min-w-0"><span className="block truncate font-semibold">{t.title}</span><span className="text-[13px] text-ink/65">{t.reference} · {timeAgo(t.updatedAt)}</span></span><Status label={s.label} kind={s.kind} /></Link></li>; })}</ul>}
          </Panel>
              </>)}
              {tab === "files" && (<>
          <Panel title="Files" icon={FilesIcon} tone="blue">
            {canWrite && (
              <form action={uploadProjectFilesAction} className="mb-4 space-y-3 rounded-xl border border-[#e4e4e7] bg-[#fafafa] p-3"><input type="hidden" name="id" value={p.id} />
                <FilePicker label="Choose files" accept={EXTRA} hint="Pictures, PDF, Word, Excel, zip or text. Up to 4 MB in one go." />
                <div><label className="label" htmlFor="fo">Folder <span className="font-normal text-ink/60">(optional)</span></label><input id="fo" name="folder" list="folders" className="field !min-h-10" placeholder="Design, Content, Contracts…" /><datalist id="folders">{folders.filter(Boolean).map((f) => <option key={f} value={f} />)}</datalist></div>
                <label className="flex items-start gap-2 text-sm font-medium"><input type="checkbox" name="shared" className="mt-0.5 size-4" /><span>Share with the customer <span className="font-normal text-ink/65">(they'll see it in their portal. Leave unticked to keep it team-only)</span></span></label>
                <SubmitButton pendingText="Uploading…">Upload</SubmitButton>
              </form>
            )}
            {files.length === 0 ? <p className="text-[15px] text-ink/70">No files yet. Upload designs, copy or documents. Team-only unless you share them.</p> : (
              <div className="space-y-4">{folders.map((fo) => (
                <div key={fo || "none"}>
                  <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-ink/75"><Folder size={15} aria-hidden />{fo || "No folder"}</p>
                  <ul className="divide-y divide-[var(--card-rule)] rounded-xl border border-[var(--card-rule)]">{files.filter((f) => (f.folder ?? "") === fo).map((f) => (
                    <li key={f.id} className="p-2.5">
                      <div className="flex items-start justify-between gap-2">{f.contentType.startsWith("image/") ? <ImageLink src={`/api/files/${f.id}`} name={f.filename} download={`/api/files/${f.id}`} className="flex min-w-0 items-center gap-1.5 break-all text-left text-[15px] font-semibold hover:underline"><Paperclip size={14} className="shrink-0" aria-hidden />{f.filename}</ImageLink> : <a href={`/api/files/${f.id}`} className="flex min-w-0 items-center gap-1.5 break-all text-[15px] font-semibold hover:underline"><Paperclip size={14} className="shrink-0" aria-hidden />{f.filename}</a>}
                        <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${f.internal ? "bg-[#e5e9f2] text-ink/75" : "bg-[#d7f3e6] text-[#0a5a3d]"}`}>{f.internal ? "Team only" : "Shared"}</span></div>
                      <p className="mt-0.5 text-[13px] text-ink/65">{kb(f.sizeBytes)} · {f.uploadedName} · {timeAgo(f.createdAt)}</p>
                      {canWrite && <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <a className={btn} href={`/api/files/${f.id}`} download><Download size={13} aria-hidden /> Download</a>
                        <form action={shareFileAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="fileId" value={f.id} /><input type="hidden" name="shared" value={f.internal ? "1" : "0"} /><button className={btn}>{f.internal ? <><Eye size={13} aria-hidden /> Share with customer</> : <><EyeOff size={13} aria-hidden /> Make team-only</>}</button></form>
                        <form action={deleteFileAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="fileId" value={f.id} /><button className={btn} aria-label={`Delete ${f.filename}`}><Trash2 size={13} aria-hidden /> Delete</button></form></div>}
                    </li>))}</ul>
                </div>))}</div>
            )}
          </Panel>
              </>)}
              {tab === "activity" && (<>
          <Panel title="History" icon={ListChecks} tone="neutral"><Timeline events={[...events].reverse().map((e) => ({ id: e.id, action: e.action, actorLabel: e.actorLabel, createdAt: e.createdAt }))} empty="Nothing has happened on this project yet." /></Panel>
          {canWrite && (
            <Panel title="Type of project" icon={Package} tone="neutral">
              <form action={projectTypeAction} className="space-y-2"><input type="hidden" name="id" value={p.id} />
                <label className="sr-only" htmlFor="pt">Type</label>
                <select id="pt" name="type" className="field" defaultValue={p.workType}>{Object.entries(PROJECT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
                <p className="text-[13px] text-ink/65">{tpl.hint} Changing it changes the steps on the progress bar and the usual tasks we suggest. Nothing is deleted.</p>
                <button className="btn btn-quiet !min-h-11 sm:!min-h-9">Save type</button></form>
            </Panel>
          )}
              </>)}
            </div>
          </>
        );
      })()}
    </>
  );
}
