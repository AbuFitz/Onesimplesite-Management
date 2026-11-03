import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { requireClient } from "@/modules/identity/session";
import { ticketAttachments } from "@/modules/files/service";
import { Files } from "@/components/file-picker";
import { clientTicket } from "@/modules/support/service";
import { ClientStatus } from "@/components/portal-bits";
import { ReplyForm } from "@/components/reply-form";
import { resolveAction } from "@/app/actions/portal";
import { Avatar, fmtDateTime } from "@/components/ui";

export const metadata = { title: "Ticket" };

export default async function TicketPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const c = await requireClient();
  const { id } = await params;
  const sp = await searchParams;
  const t = await clientTicket(c, id);
  if (!t) notFound();
  const files = await ticketAttachments(t.id, false);
  const closed = t.status === "closed";
  return (
    <div className="space-y-4">
      <Link href="/help" className="text-sm font-semibold underline">Back to help</Link>
      {sp.new && <div role="status" className="tile bg-mint flex items-center gap-3 !p-5"><CheckCircle2 aria-hidden /><p className="font-semibold">Sent. We've emailed you a copy and the team will reply here.</p></div>}
      <section className="tile bg-white !p-6 sm:!p-8">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl sm:text-4xl">{t.title}</h1><p className="mt-1 text-sm text-muted">{t.reference}{t.project ? ` · ${t.project.name}` : ""} · raised {fmtDateTime(t.createdAt)}</p></div><ClientStatus status={t.status} /></div>
        {t.body && <p className="mt-5 whitespace-pre-wrap rounded-2xl bg-bone p-4">{t.body}</p>}
        <Files base="/files" items={files.filter((f) => !f.commentId)} />
      </section>
      <section className="space-y-3" aria-label="Conversation">
        {t.comments.map((m) => (
          <div key={m.id} className={`tile !p-5 ${m.authorKind === "client" ? "bg-sky/60" : "bg-white"}`}>
            <div className="mb-2 flex items-center gap-3"><Avatar name={m.authorName} size={32} /><div><p className="font-bold leading-tight">{m.authorKind === "client" ? "You" : m.authorName}</p><p className="text-xs text-muted">{fmtDateTime(m.createdAt)}</p></div></div>
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
