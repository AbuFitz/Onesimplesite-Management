import { notFound } from "next/navigation";
import Link from "next/link";
import { Folder, Paperclip, Download, ListChecks, Megaphone } from "lucide-react";
import { requireClient } from "@/modules/identity/session";
import { clientProject, STAGE_COPY } from "@/modules/portal/service";
import { projectFileList } from "@/modules/files/service";
import { fmtDate, fmtDateTime } from "@/components/ui";
import { FilePicker } from "@/components/file-picker";
import { SubmitButton } from "@/components/submit-button";
import { sendToProjectAction } from "@/app/actions/portal";
import { clientCan } from "@/modules/portal/access";

export const metadata = { title: "Project" };
const STEPS = ["Planning", "Design", "Build", "Review", "Live"] as const;
const stepOf = (stage: string) => ({ planned: 0, awaiting_assets: 0, design: 1, development: 2, qa: 2, client_review: 3, ready_to_launch: 3, launched: 4, completed: 4 } as Record<string, number>)[stage] ?? 0;
const kb = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

export default async function PortalProject({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sent?: string; error?: string; open?: string }> }) {
  const c = await requireClient();
  const sp = await searchParams;
  const p = await clientProject(c, (await params).id);
  if (!p) notFound(); // identical response for "missing" and "not yours"
  const files = await projectFileList(p.id, false);
  const folders = [...new Set(files.map((f) => f.folder ?? ""))].sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
  const todo = p.assetRequests.filter((a) => !a.receivedAt);
  const canSend = clientCan(c, p.customerId, "tickets");
  const ACCEPT = "image/png,image/jpeg,image/gif,image/webp,application/pdf,.zip,.txt,.doc,.docx,.xls,.xlsx";
  return (
    <div className="space-y-4">
      <section className="tile bg-mint !p-7 sm:!p-10">
        <h1 className="text-3xl sm:text-5xl">{p.name}</h1>
        <p className="mt-3 max-w-xl text-lg font-medium">{STAGE_COPY[p.stage]}</p>
        <ol className="mt-6 grid max-w-2xl grid-cols-5 gap-1.5" aria-label="Progress">{STEPS.map((s, i) => <li key={s} aria-current={i === stepOf(p.stage) ? "step" : undefined}><div className={`h-2.5 rounded-full ${i <= stepOf(p.stage) ? "bg-ink" : "bg-white/70"}`} /><p className={`mt-1.5 text-xs sm:text-sm ${i === stepOf(p.stage) ? "font-bold" : ""}`}>{s}</p></li>)}</ol>
        {p.dueDate && <p className="mt-4 text-sm">Aiming for <strong>{fmtDate(p.dueDate)}</strong></p>}
      </section>

      {sp.sent && <p role="status" className="rounded-2xl bg-mint px-5 py-3 font-semibold">Sent. We've got it, thank you.</p>}
      {sp.error && <p role="alert" className="rounded-2xl bg-blush px-5 py-3 font-semibold">{sp.error}</p>}

      {p.assetRequests.length > 0 && (
        <section className="tile bg-butter" aria-labelledby="a"><h2 id="a" className="flex items-center gap-2 text-2xl"><ListChecks size={22} aria-hidden /> What we need from you</h2>
          <p className="mt-1 text-sm">{todo.length ? `${todo.length} to send. Add it right here, no ticket needed.` : "Everything we asked for is in. Thank you."} Please never send passwords.</p>
          <ul className="mt-3 space-y-2">{p.assetRequests.map((a) => (
            <li key={a.id} className="rounded-xl bg-white/85">
              <details open={!a.receivedAt && (sp.open === a.id || todo[0]?.id === a.id)} className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3"><span className="font-semibold">{a.label}{!a.required && <span className="font-normal text-muted"> (optional)</span>}{a.dueDate ? <span className="font-normal text-muted"> · by {fmtDate(a.dueDate)}</span> : null}</span>
                  <span className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold ${a.receivedAt ? "bg-mint" : "bg-ink text-white"}`}>{a.receivedAt ? "Sent ✓" : canSend ? "Add" : "Needed"}</span></summary>
                {a.response && <p className="mx-4 mb-2 whitespace-pre-wrap break-words rounded-lg bg-bone px-3 py-2 text-sm"><span className="font-semibold">You sent:</span> {a.response}</p>}
                {canSend && (
                  <form action={sendToProjectAction} className="space-y-3 border-t border-line px-4 py-4">
                    <input type="hidden" name="projectId" value={p.id} /><input type="hidden" name="assetId" value={a.id} />
                    <div><label className="label" htmlFor={`t-${a.id}`}>{a.receivedAt ? "Add something more" : "Type it here, or add a link"} <span className="font-normal text-muted">(optional if you add a file)</span></label><textarea id={`t-${a.id}`} name="text" rows={3} maxLength={5000} className="field" placeholder="e.g. our opening hours, text for the About page, a link to our photos" /></div>
                    <FilePicker label="Add files" accept={ACCEPT} hint="Logos, photos, PDFs, Word or Excel files, zips. Up to 4 files, 4 MB in all." />
                    <SubmitButton className="btn w-full sm:w-auto" pendingText="Sending…">Send to us</SubmitButton>
                  </form>)}
              </details>
            </li>))}</ul></section>
      )}

      {canSend && (
        <section className="tile bg-sky" aria-labelledby="x"><h2 id="x" className="text-2xl">Send us something else</h2>
          <p className="mt-1 text-sm">Extra photos, a new price list, changes to your wording. It goes straight into your project.</p>
          <form action={sendToProjectAction} className="mt-3 space-y-3 rounded-xl bg-white/85 p-4">
            <input type="hidden" name="projectId" value={p.id} />
            <div><label className="label" htmlFor="x-t">What is it?</label><textarea id="x-t" name="text" rows={3} maxLength={5000} className="field" placeholder="A few words, or a link" /></div>
            <FilePicker label="Add files" accept={ACCEPT} hint="Up to 4 files, 4 MB in all." />
            <SubmitButton className="btn w-full sm:w-auto" pendingText="Sending…">Send to us</SubmitButton>
          </form></section>
      )}

      <section className="tile bg-white" aria-labelledby="f"><h2 id="f" className="flex items-center gap-2 text-2xl"><Folder size={22} aria-hidden /> Files</h2>
        {files.length === 0 ? <p className="mt-2 text-muted">Designs and documents we share, and anything you send, will appear here.</p> : (
          <div className="mt-3 space-y-4">{folders.map((fo) => (
            <div key={fo || "none"}>{fo && <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-muted"><Folder size={14} aria-hidden />{fo}</p>}
              <ul className="divide-y divide-line rounded-2xl border border-line">{files.filter((f) => (f.folder ?? "") === fo).map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 p-3"><span className="flex min-w-0 items-center gap-2"><Paperclip size={16} className="shrink-0" aria-hidden /><span className="min-w-0"><span className="block truncate font-semibold">{f.filename}</span><span className="text-sm text-muted">{kb(f.sizeBytes)} · {fmtDate(f.createdAt)}</span></span></span>
                  <a className="btn btn-quiet shrink-0" href={`/files/${f.id}`} download={!f.contentType.startsWith("image/")} target={f.contentType.startsWith("image/") ? "_blank" : undefined}><Download size={15} aria-hidden /> {f.contentType.startsWith("image/") ? "View" : "Download"}</a></li>))}</ul></div>))}</div>
        )}
      </section>

      <section className="tile bg-white" aria-labelledby="u"><h2 id="u" className="flex items-center gap-2 text-2xl"><Megaphone size={22} aria-hidden /> Updates</h2>
        {p.updates.length === 0 ? <p className="mt-2 text-muted">No updates yet. We'll post here as things move.</p> : <ul className="mt-3 space-y-4">{p.updates.map((u) => <li key={u.id} className="flex gap-3"><span className="mt-2 size-2.5 shrink-0 rounded-full bg-spring" aria-hidden /><div><p className="text-xs text-muted">{fmtDateTime(u.createdAt)}</p><p className="whitespace-pre-wrap">{u.body}</p></div></li>)}</ul>}
      </section>
    </div>
  );
}
