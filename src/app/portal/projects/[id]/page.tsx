import { notFound } from "next/navigation";
import Link from "next/link";
import { Folder, Paperclip, Download, ListChecks, Megaphone } from "lucide-react";
import { requireClient } from "@/modules/identity/session";
import { clientProject, STAGE_COPY } from "@/modules/portal/service";
import { projectFileList } from "@/modules/files/service";
import { fmtDate, fmtDateTime } from "@/components/ui";

export const metadata = { title: "Project" };
const STEPS = ["Planning", "Design", "Build", "Review", "Live"] as const;
const stepOf = (stage: string) => ({ planned: 0, awaiting_assets: 0, design: 1, development: 2, qa: 2, client_review: 3, ready_to_launch: 3, launched: 4, completed: 4 } as Record<string, number>)[stage] ?? 0;
const kb = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

export default async function PortalProject({ params }: { params: Promise<{ id: string }> }) {
  const c = await requireClient();
  const p = await clientProject(c, (await params).id);
  if (!p) notFound(); // identical response for "missing" and "not yours"
  const files = await projectFileList(p.id, false);
  const folders = [...new Set(files.map((f) => f.folder ?? ""))].sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
  const todo = p.assetRequests.filter((a) => !a.receivedAt);
  return (
    <div className="space-y-4">
      <section className="tile bg-mint !p-7 sm:!p-10">
        <h1 className="text-3xl sm:text-5xl">{p.name}</h1>
        <p className="mt-3 max-w-xl text-lg font-medium">{STAGE_COPY[p.stage]}</p>
        <ol className="mt-6 grid max-w-2xl grid-cols-5 gap-1.5" aria-label="Progress">{STEPS.map((s, i) => <li key={s} aria-current={i === stepOf(p.stage) ? "step" : undefined}><div className={`h-2.5 rounded-full ${i <= stepOf(p.stage) ? "bg-ink" : "bg-white/70"}`} /><p className={`mt-1.5 text-xs sm:text-sm ${i === stepOf(p.stage) ? "font-bold" : ""}`}>{s}</p></li>)}</ol>
        {p.dueDate && <p className="mt-4 text-sm">Aiming for <strong>{fmtDate(p.dueDate)}</strong></p>}
      </section>

      {p.assetRequests.length > 0 && (
        <section className="tile bg-butter" aria-labelledby="a"><h2 id="a" className="flex items-center gap-2 text-2xl"><ListChecks size={22} aria-hidden /> What we need from you</h2>
          <ul className="mt-3 space-y-2">{p.assetRequests.map((a) => <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/80 px-4 py-3"><span className="font-semibold">{a.label}{a.dueDate ? <span className="font-normal text-muted"> · by {fmtDate(a.dueDate)}</span> : null}</span><span className={`rounded-full px-3 py-1 text-sm font-bold ${a.receivedAt ? "bg-mint text-[#0a5a3d]" : "bg-blush text-[#7a2e12]"}`}>{a.receivedAt ? "Got it" : "Needed"}</span></li>)}</ul>
          {todo.length > 0 && <p className="mt-3 text-sm">Send these to your project contact, or <Link className="font-semibold underline" href="/help/new">raise a ticket</Link> and attach them. Please never send passwords.</p>}</section>
      )}

      <section className="tile bg-white" aria-labelledby="f"><h2 id="f" className="flex items-center gap-2 text-2xl"><Folder size={22} aria-hidden /> Files from us</h2>
        {files.length === 0 ? <p className="mt-2 text-muted">Designs and documents we share with you will appear here.</p> : (
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
