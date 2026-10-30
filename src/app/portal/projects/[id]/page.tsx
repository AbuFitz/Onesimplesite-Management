import { notFound } from "next/navigation";
import { requireClient } from "@/modules/identity/session";
import { clientProject, STAGE_COPY } from "@/modules/portal/service";
import { Status, fmtDate, fmtDateTime } from "@/components/ui";

export const metadata = { title: "Project" };
export default async function PortalProject({ params }: { params: Promise<{ id: string }> }) {
  const c = await requireClient();
  const p = await clientProject(c, (await params).id);
  if (!p) notFound(); // identical response for "missing" and "not yours"
  return (
    <>
      <p className="mb-1 text-sm text-muted"><a className="hover:text-ink" href="/projects">‹ Projects</a></p>
      <h1>{p.name}</h1>
      <p className="mt-1 mb-10 text-muted">{STAGE_COPY[p.stage]}</p>
      {p.assetRequests.length > 0 && <section aria-labelledby="a" className="mb-10"><h2 id="a" className="mb-2">What we need from you</h2>
        <ul>{p.assetRequests.map((a) => <li key={a.id} className="row py-2 flex justify-between gap-3"><span>{a.label}{a.dueDate ? ` · by ${fmtDate(a.dueDate)}` : ""}</span><Status label={a.receivedAt ? "received" : "needed"} kind={a.receivedAt ? "good" : "warn"} /></li>)}</ul>
        <p className="hint mt-2">Upload from the portal is coming soon. For now, send files to your project contact. Never send passwords by email or chat.</p></section>}
      <section aria-labelledby="u"><h2 id="u" className="mb-2">Updates</h2>
        {p.updates.length === 0 ? <p className="text-sm text-muted">No updates yet.</p> : <ul>{p.updates.map((u) => <li key={u.id} className="row py-3"><p className="text-xs text-muted">{fmtDateTime(u.createdAt)}</p><p className="whitespace-pre-wrap">{u.body}</p></li>)}</ul>}</section>
    </>
  );
}
