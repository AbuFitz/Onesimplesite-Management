import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStaff } from "@/modules/identity/session";
import { getTerms } from "@/modules/settings/service";
import { isLegalKind, LEGAL } from "@/modules/settings/legal-docs";
import { saveLegalAction, publishLegalAction } from "@/app/actions/work";
import { placeholderCount } from "@/documents/parse";
import { LegalEditor } from "@/components/legal-editor";
import { RecordHeader, Status, ErrorSummary } from "@/components/ui";

export const metadata = { title: "Legal document" };
export default async function LegalEditorPage({ params, searchParams }: { params: Promise<{ kind: string; id: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const ctx = await requireStaff("settings.write");
  const { kind, id } = await params;
  if (!isLegalKind(kind)) notFound();
  const sp = await searchParams;
  const t = await getTerms(ctx, id);
  if (!t || t.kind !== kind) notFound();
  const draft = t.status === "draft";
  const todo = placeholderCount(t.body);
  const m = LEGAL[kind];
  return (
    <>
      <RecordHeader back={{ href: `/settings/legal/${kind}`, label: m.label }} title={`${m.label}, version ${t.number}`} status={<Status label={t.status} kind={t.status === "published" ? "good" : draft ? "warn" : "neutral"} />}
        action={kind === "terms" ? <Link className="btn btn-quiet" href={`/settings/legal/terms/${t.id}/sample.pdf`}>Sample PDF</Link> : undefined} />
      <ErrorSummary message={sp.error} />
      {sp.saved && <p role="status" className="mb-4 text-sm text-moss">Saved.</p>}
      {!draft && <p className="mb-4 text-sm text-muted">{t.status === "published" ? "This version is published and can't be changed." : "This version is retired."} Saving creates a new draft based on it.</p>}
      <LegalEditor
        id={t.id} kind={kind} initialTitle={t.title} initialBody={t.body} saveAction={saveLegalAction}
        meta={{ ref: m.ref, audience: m.audience, version: `${t.number}.0`, status: t.status[0].toUpperCase() + t.status.slice(1), date: new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(t.publishedAt ?? t.updatedAt) }}
        saveLabel={draft ? "Save draft" : "Save as new draft"}
      />
      {draft && (
        <form action={publishLegalAction} className="mt-8 max-w-2xl border-t border-line pt-5"><input type="hidden" name="id" value={t.id} /><input type="hidden" name="kind" value={kind} />
          <h2 className="mb-1">Publish</h2>
          <p className="hint mb-3">{todo > 0 ? `${todo} item(s) still marked [TBC: …]. Publishing is blocked until they are replaced. Save your draft first.` : kind === "terms" ? "Publishing makes this the version used for every new agreement. It can't be edited afterwards." : "Publishing makes this the version the team uses. It can't be edited afterwards; changes make a new version."}</p>
          <button className="btn" disabled={todo > 0}>Publish version {t.number}</button></form>
      )}
    </>
  );
}
