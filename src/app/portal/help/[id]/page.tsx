import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { requireClient } from "@/modules/identity/session";
import { ticketAttachments } from "@/modules/files/service";
import { Files } from "@/components/file-picker";
import { clientTicket } from "@/modules/support/service";
import { ClientStatus } from "@/components/portal-bits";
import { ReplyForm } from "@/components/reply-form";
import { resolveAction, approveChangeAction, declineChangeAction } from "@/app/actions/portal";
import { memberCan } from "@/modules/portal/access";
import { money } from "@/modules/billing/service";
import { Avatar, fmtDateTime } from "@/components/ui";

export const metadata = { title: "Ticket" };

export default async function TicketPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string; approved?: string; error?: string }> }) {
  const c = await requireClient();
  const { id } = await params;
  const sp = await searchParams;
  const t = await clientTicket(c, id);
  if (!t) notFound();
  const files = await ticketAttachments(t.id, false);
  const closed = t.status === "closed";
  const canApprove = c.memberships.some((m) => m.customerId === t.customerId && memberCan(m, "billing"));
  return (
    <div className="space-y-4">
      {sp.new && <div role="status" className="tile bg-mint flex items-center gap-3 !p-5"><CheckCircle2 aria-hidden /><p className="font-semibold">Sent. We've emailed you a copy and the team will reply here.</p></div>}
      {sp.error && <div role="alert" className="tile bg-blush !p-5 font-semibold">{sp.error}</div>}
      {sp.approved && <div role="status" className="tile bg-mint !p-5 font-semibold">Thanks. We'll get started. You can pay from the Billing page.</div>}
      {t.chargeStatus === "quoted" && t.priceMinor ? (
        <section className="tile bg-butter !p-6 sm:!p-8" aria-label="Approve the cost">
          <h2 className="text-3xl">This change costs {money(t.priceMinor)}</h2>
          <p className="mt-2 max-w-xl">It's outside what your plan covers, so we always ask first. Nothing starts until you say yes.</p>
          {canApprove ? (
            <div className="mt-5 flex flex-wrap items-start gap-3">
              <form action={approveChangeAction}><input type="hidden" name="id" value={t.id} /><button className="btn btn-dark">Approve {money(t.priceMinor)}</button></form>
              <form action={declineChangeAction} className="flex flex-wrap items-center gap-2"><input type="hidden" name="id" value={t.id} /><label className="sr-only" htmlFor="why">Why not?</label><input id="why" name="reason" className="field !min-h-10 w-56" placeholder="Not now? Tell us why (optional)" /><button className="btn btn-quiet">Not now</button></form>
            </div>
          ) : <p className="mt-4 font-semibold">Ask the company owner to approve this.</p>}
        </section>
      ) : t.chargeStatus === "approved" ? <section className="tile bg-mint !p-5"><p className="font-semibold">You approved {money(t.priceMinor ?? 0)}. <Link className="underline" href="/billing">Pay now</Link></p></section>
        : t.chargeStatus === "paid" ? <section className="tile bg-mint !p-5"><p className="font-semibold">{money(t.priceMinor ?? 0)} paid. Thank you.</p></section> : null}
      <section className="tile bg-white !p-6 sm:!p-8">
        <ol className="mb-5 grid max-w-xl grid-cols-3 gap-2" aria-label="Progress">{[["Received", true], [t.assigneeName ? `${t.assigneeName} is on it` : "Picked up", !!t.assigneeName || !["open"].includes(t.status)], ["Sorted", ["resolved", "closed"].includes(t.status)]].map(([l, on]) => <li key={String(l)}><div className={`h-2 rounded-full ${on ? "bg-ink" : "bg-line"}`} /><p className={`mt-1.5 text-sm ${on ? "font-bold" : "text-muted"}`}>{l as string}</p></li>)}</ol>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl sm:text-4xl">{t.title}</h1><p className="mt-1 text-sm text-muted">{t.reference}{t.project ? ` · ${t.project.name}` : ""} · raised {fmtDateTime(t.createdAt)}</p></div><ClientStatus status={t.status} /></div>
        {t.body && <p className="mt-5 whitespace-pre-wrap rounded-2xl bg-bone p-4">{t.body}</p>}
        <Files base="/files" items={files.filter((f) => !f.commentId)} />
      </section>
      <section className="space-y-3" aria-label="Conversation">
        {t.comments.map((m) => m.authorKind === "event" ? (
          <p key={m.id} className="mx-auto flex w-fit max-w-full items-center gap-2 rounded-full bg-mint px-4 py-1.5 text-sm font-semibold"><span className="size-2 shrink-0 rounded-full bg-ink" aria-hidden />{m.body}<span className="font-normal text-muted">{fmtDateTime(m.createdAt)}</span></p>
        ) : (
          <div key={m.id} className={`tile !p-5 ${m.authorKind === "client" ? "bg-sky/60" : "bg-white"}`}>
            <div className="mb-2 flex items-center gap-3"><Avatar name={m.authorName} size={32} staffId={m.authorKind === "staff" ? m.authorStaffId : m.authorUserId} base={m.authorKind === "staff" ? "/avatar" : "/avatar/u"} /><div><p className="font-bold leading-tight">{m.authorKind === "client" ? "You" : m.authorName}</p><p className="text-xs text-muted">{fmtDateTime(m.createdAt)}</p></div></div>
            <p className="whitespace-pre-wrap">{m.body}</p>
            <Files base="/files" items={files.filter((f) => f.commentId === m.id)} />
          </div>
        ))}
      </section>
      {!closed && (
        <section className="tile bg-white !p-6"><ReplyForm id={t.id} />
          {t.status !== "resolved" && <form action={resolveAction} className="mt-4 border-t border-line pt-4"><input type="hidden" name="id" value={t.id} /><button className="btn btn-quiet">This is sorted, thanks</button></form>}
        </section>
      )}
    </div>
  );
}
