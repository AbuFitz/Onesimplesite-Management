import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/modules/identity/session";
import { getSupportTicket, STATUSES, PRIORITIES } from "@/modules/support/service";
import { ticketAttachments } from "@/modules/files/service";
import { db } from "@/lib/db";
import { supportReplyAction, supportUpdateAction, quoteChangeAction } from "@/app/actions/support";
import { RecordHeader, Status, Avatar, ErrorSummary, fmtDateTime } from "@/components/ui";
import { FilePicker, Files } from "@/components/file-picker";
import { Panel } from "@/components/panel";
import { PoundSterling, ListChecks, UserRound, MessageSquare } from "lucide-react";
import { AutoSelect } from "@/components/auto-form";
import { LiveRefresh } from "@/components/live-refresh";
import { STATUS_LABEL, CATEGORY_LABEL } from "@/modules/support/options";
import { money } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { SheetButton } from "@/components/sheet-button";
import { WaitTimer } from "@/components/ticket-timer";
import { TicketComposer } from "@/components/ticket-composer";
import { TicketThread } from "@/components/ticket-thread";
import { TEAM_WAIT_HOURS } from "@/modules/support/reminders";

export const metadata = { title: "Support ticket" };
const CHARGE: Record<string, string> = { quoted: "Waiting for them to approve", approved: "Approved. Payment is on their Billing page", paid: "Paid", declined: "They declined this price", none: "" };
const PRI: Record<string, string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };

export default async function SupportTicket({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; sent?: string; saved?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const { id } = await params; const sp = await searchParams;
  const t = await getSupportTicket(ctx, id);
  if (!t) notFound();
  const [files, team] = await Promise.all([ticketAttachments(t.id, true), db.staffMembership.findMany({ where: { workspaceId: ctx.workspaceId, status: "active" }, select: { id: true, displayName: true }, orderBy: { displayName: "asc" } })]);
  const s = STATUS_LABEL[t.status] ?? { label: t.status, kind: "neutral" as const };
  const waitingOnUs = !['resolved', 'closed', 'waiting_customer'].includes(t.status) && +(t.lastCustomerAt ?? t.createdAt) > +(t.lastStaffAt ?? 0);
  const side = (pfx: string) => (
    <>
          <Panel title="Status and owner" icon={ListChecks} tone="blue"><form action={supportUpdateAction} className="space-y-3">
            <input type="hidden" name="id" value={t.id} />
            <div><label className="label" htmlFor={`${pfx}st`}>Status</label><select id={`${pfx}st`} name="status" className="field" defaultValue={t.status}>{STATUSES.map((x) => <option key={x} value={x}>{STATUS_LABEL[x]?.label ?? x}</option>)}</select></div>
            <div><label className="label" htmlFor={`${pfx}pr`}>Priority</label><select id={`${pfx}pr`} name="priority" className="field" defaultValue={t.priority}>{PRIORITIES.map((x) => <option key={x} value={x}>{PRI[x]}</option>)}</select></div>
            <div><label className="label" htmlFor={`${pfx}as`}>Owner</label><select id={`${pfx}as`} name="assigneeId" className="field" defaultValue={t.assigneeId ?? ""}><option value="">Nobody yet</option>{team.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}</select></div>
            <button className="btn btn-quiet w-full">Save</button>
          </form></Panel>
          {t.contact && <Panel title="Raised by" icon={UserRound}><div className="text-[15px]"><p className="font-semibold">{t.contact.name}</p>{t.contact.position && <p className="text-muted">{t.contact.position}</p>}{t.contact.email && <p><a className="underline" href={`mailto:${t.contact.email}`}>{t.contact.email}</a></p>}{t.contact.phone && <p>{t.contact.phone}</p>}</div></Panel>}
          <Panel title="Cost" icon={PoundSterling} tone="amber">
            {t.chargeStatus !== "none" || t.priceMinor ? (
              <p className="text-sm"><strong>{t.priceMinor ? money(t.priceMinor) : "Included in their plan"}</strong>{CHARGE[t.chargeStatus] ? ` · ${CHARGE[t.chargeStatus]}` : ""}{t.approvedByName ? ` (${t.approvedByName})` : ""}</p>
            ) : <p className="text-sm text-muted">Not priced. If this is outside their plan, set a price and they approve it in the portal before you start.</p>}
            {!["approved", "paid"].includes(t.chargeStatus) && (
              <form action={quoteChangeAction} className="space-y-2"><input type="hidden" name="id" value={t.id} />
                <label className="label" htmlFor={`${pfx}q-p`}>Price (£)</label><input id={`${pfx}q-p`} name="price" type="number" min="1" step="0.01" inputMode="decimal" className="field !min-h-11 sm:!min-h-9" defaultValue={t.priceMinor ? (t.priceMinor / 100).toFixed(2) : ""} />
                <label className="label" htmlFor={`${pfx}q-n`}>Note for them</label><input id={`${pfx}q-n`} name="note" className="field !min-h-11 sm:!min-h-9" placeholder="Optional" />
                <div className="flex flex-wrap gap-2"><SubmitButton pendingText="Sending…">{t.chargeStatus === "quoted" ? "Send the new price" : "Send price for approval"}</SubmitButton><button name="included" value="1" formNoValidate className="btn btn-quiet">No charge</button></div>
              </form>
            )}
          </Panel>
    </>
  );
  return (
    <>
      <LiveRefresh seconds={20} />
      <RecordHeader back={{ href: "/support", label: "Support tickets" }} title={t.title} status={<AutoSelect action={supportUpdateAction} name="status" value={t.status} label="Ticket status" hidden={{ id: t.id }} options={STATUSES.map((x) => ({ value: x, label: STATUS_LABEL[x]?.label ?? x }))} />} meta={<><span className={`mr-2 rounded-md px-2 py-0.5 text-xs font-semibold ${CATEGORY_LABEL[t.category]?.cls ?? ""}`}>{CATEGORY_LABEL[t.category]?.label ?? "Support"}</span>{t.reference}{waitingOnUs && <> · <WaitTimer since={(t.lastCustomerAt ?? t.createdAt).toISOString()} limitHours={TEAM_WAIT_HOURS[t.priority as keyof typeof TEAM_WAIT_HOURS] ?? 24} /></>} · <Link className="underline" href={`/customers/${t.customer.id}`}>{t.customer.displayName}</Link>{t.contact ? ` · ${t.contact.name}${t.contact.position ? `, ${t.contact.position}` : ""}` : ""}{t.project ? ` · ${t.project.name}` : ""}</>} />
      <div className="mb-3 lg:hidden"><SheetButton label="Details, owner and price" title="Ticket details" className="btn btn-quiet" icon={false}><div className="space-y-4">{side("m-")}</div></SheetButton></div>
      <ErrorSummary message={sp.error} />
      {sp.sent && <p role="status" className="mb-3 text-sm text-moss">{sp.sent === "note" ? "Note saved. Only the team can see it." : "Reply sent."}</p>}
      {sp.saved && <p role="status" className="mb-3 text-sm text-moss">Saved.</p>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <TicketThread first={{ id: "first", authorKind: t.source === "portal" ? "customer" : "staff", internal: false, authorName: t.source === "portal" ? (t.contact?.name ?? t.customer.displayName) : "Team", authorUserId: null, body: t.body ?? "", createdAt: t.createdAt }} comments={t.comments} files={files as never} />
          <div className="mt-4">
            <TicketComposer key={t.comments.length} action={supportReplyAction} id={t.id} to={t.contact?.name.split(" ")[0] ?? "the customer"}>
            <FilePicker label="Add pictures or a PDF" />
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="filesInternal" className="mt-1 size-4 accent-[#0c6a49]" /><span>Only the team can see the files</span></label>
          </TicketComposer>
          </div>
        </div>
        <aside className="hidden space-y-4 lg:block">{side("d-")}</aside>
      </div>
    </>
  );
}
