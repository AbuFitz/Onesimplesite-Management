import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/modules/identity/session";
import { getSupportTicket, STATUSES, PRIORITIES } from "@/modules/support/service";
import { ticketAttachments } from "@/modules/files/service";
import { db } from "@/lib/db";
import { supportReplyAction, supportUpdateAction } from "@/app/actions/support";
import { RecordHeader, Status, Avatar, ErrorSummary, fmtDateTime } from "@/components/ui";
import { FilePicker, Files } from "@/components/file-picker";
import { LiveRefresh } from "@/components/live-refresh";
import { STATUS_LABEL } from "@/modules/support/options";

export const metadata = { title: "Support ticket" };
const PRI: Record<string, string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };

export default async function SupportTicket({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; sent?: string; saved?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const { id } = await params; const sp = await searchParams;
  const t = await getSupportTicket(ctx, id);
  if (!t) notFound();
  const [files, team] = await Promise.all([ticketAttachments(t.id, true), db.staffMembership.findMany({ where: { workspaceId: ctx.workspaceId, status: "active" }, select: { id: true, displayName: true }, orderBy: { displayName: "asc" } })]);
  const s = STATUS_LABEL[t.status] ?? { label: t.status, kind: "neutral" as const };
  return (
    <>
      <LiveRefresh seconds={20} />
      <RecordHeader back={{ href: "/support", label: "Support tickets" }} title={t.title} status={<Status label={s.label} kind={s.kind} />} meta={<>{t.reference} · <Link className="underline" href={`/customers/${t.customer.id}`}>{t.customer.displayName}</Link>{t.contact ? ` · ${t.contact.name}${t.contact.position ? `, ${t.contact.position}` : ""}` : ""}{t.project ? ` · ${t.project.name}` : ""}</>} />
      <ErrorSummary message={sp.error} />
      {sp.sent && <p role="status" className="mb-3 text-sm text-moss">{sp.sent === "note" ? "Note saved. Only the team can see it." : "Reply sent."}</p>}
      {sp.saved && <p role="status" className="mb-3 text-sm text-moss">Saved.</p>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3">
          <article className="rounded-2xl border border-line bg-white p-4"><p className="mb-1 text-sm text-muted">Raised {fmtDateTime(t.createdAt)}{t.source === "portal" ? " from the portal" : " by the team"}</p><p className="whitespace-pre-wrap">{t.body}</p><Files base="/api/files" items={files.filter((f) => !f.commentId)} /></article>
          {t.comments.map((m) => (
            <article key={m.id} className={`rounded-2xl border p-4 ${m.internal ? "border-[#e5d58a] bg-[#fbf3d5]" : m.authorKind === "staff" ? "border-line bg-white" : "border-line bg-[#eaf4fb]"}`}>
              <div className="mb-1 flex items-center gap-2"><Avatar name={m.authorName} size={28} staffId={m.authorStaffId} /><p className="font-semibold">{m.authorName}</p><p className="text-sm text-muted">{fmtDateTime(m.createdAt)}</p>{m.internal && <span className="ml-auto rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-white">Only the team sees this</span>}</div>
              <p className="whitespace-pre-wrap">{m.body}</p>
              <Files base="/api/files" items={files.filter((f) => f.commentId === m.id)} />
            </article>
          ))}
          <form action={supportReplyAction} className="space-y-3 rounded-2xl border border-line bg-white p-4">
            <input type="hidden" name="id" value={t.id} />
            <label className="label" htmlFor="body">Write a reply</label>
            <textarea id="body" name="body" rows={5} className="field" required />
            <FilePicker label="Add pictures or a PDF" />
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="filesInternal" className="mt-1 size-4 accent-[#0c6a49]" /><span>Only the team can see the files <span className="text-muted">(the message itself is still sent to the customer)</span></span></label>
            <div className="flex flex-wrap gap-2">
              <button name="mode" value="reply" className="btn">{t.contact?.email ? `Send to ${t.contact.name.split(" ")[0]}` : "Send reply"}</button>
              <button name="mode" value="note" className="btn btn-quiet">Save as team note</button>
            </div>
            <p className="hint">Replies go out from your own address (for example “Abukar at OneSimpleSite”) and appear in the customer's portal. Team notes and their files are never shown to the customer.</p>
          </form>
        </div>
        <aside className="space-y-4">
          <form action={supportUpdateAction} className="space-y-3 rounded-2xl border border-line bg-white p-4">
            <input type="hidden" name="id" value={t.id} />
            <div><label className="label" htmlFor="st">Status</label><select id="st" name="status" className="field" defaultValue={t.status}>{STATUSES.map((x) => <option key={x} value={x}>{STATUS_LABEL[x]?.label ?? x}</option>)}</select></div>
            <div><label className="label" htmlFor="pr">Priority</label><select id="pr" name="priority" className="field" defaultValue={t.priority}>{PRIORITIES.map((x) => <option key={x} value={x}>{PRI[x]}</option>)}</select></div>
            <div><label className="label" htmlFor="as">Owner</label><select id="as" name="assigneeId" className="field" defaultValue={t.assigneeId ?? ""}><option value="">Nobody yet</option>{team.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}</select></div>
            <button className="btn btn-quiet w-full">Save</button>
          </form>
          {t.contact && <div className="rounded-2xl border border-line bg-white p-4 text-sm"><p className="label">Raised by</p><p className="font-semibold">{t.contact.name}</p>{t.contact.position && <p className="text-muted">{t.contact.position}</p>}{t.contact.email && <p><a className="underline" href={`mailto:${t.contact.email}`}>{t.contact.email}</a></p>}{t.contact.phone && <p>{t.contact.phone}</p>}</div>}
        </aside>
      </div>
    </>
  );
}
