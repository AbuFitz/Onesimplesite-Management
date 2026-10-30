import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStaff } from "@/modules/identity/session";
import { getTerms } from "@/modules/settings/service";
import { saveTermsAction, publishTermsAction } from "@/app/actions/work";
import { placeholderCount } from "@/documents/parse";
import { AgreementText } from "@/components/agreement";
import { RecordHeader, Status, ErrorSummary } from "@/components/ui";

export const metadata = { title: "Terms version" };
export default async function TermsEditor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const ctx = await requireStaff("settings.write");
  const { id } = await params;
  const sp = await searchParams;
  const t = await getTerms(ctx, id);
  if (!t) notFound();
  const draft = t.status === "draft";
  const todo = placeholderCount(t.body);
  return (
    <>
      <RecordHeader back={{ href: "/settings/terms", label: "Terms & Conditions" }} title={`${t.title}, version ${t.number}`} status={<Status label={t.status} kind={t.status === "published" ? "good" : draft ? "warn" : "neutral"} />} />
      <ErrorSummary message={sp.error} />
      {sp.saved && <p role="status" className="mb-4 text-sm text-moss">Saved.</p>}
      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="ed">
          <h2 id="ed" className="mb-2">{draft ? "Edit draft" : "Read-only"}</h2>
          {!draft && <p className="mb-3 text-sm text-muted">{t.status === "published" ? "This version is published and can't be changed." : "This version is retired."} Saving creates a new draft based on it.</p>}
          <form action={saveTermsAction} className="space-y-3"><input type="hidden" name="id" value={t.id} />
            <div><label className="label" htmlFor="title">Title</label><input id="title" name="title" className="field" defaultValue={t.title} required /></div>
            <div><label className="label" htmlFor="body">Wording</label><textarea id="body" name="body" className="field min-h-[60dvh] font-mono text-sm" defaultValue={t.body} required />
              <p className="hint mt-1">Use <code>## Heading</code> for a section and <code>1.1 Clause text</code> for a numbered clause. Replace every <code>[TBC: …]</code> with real wording before publishing.</p></div>
            <button className="btn">{draft ? "Save draft" : "Save as new draft"}</button>
          </form>
          {draft && (
            <form action={publishTermsAction} className="mt-6 border-t border-line pt-4"><input type="hidden" name="id" value={t.id} />
              <h2 className="mb-1">Publish</h2>
              <p className="hint mb-2">{todo > 0 ? `${todo} placeholder(s) still marked [TBC: …]. Publishing is blocked until they are replaced.` : "Publishing makes this the version used for every new agreement. It can't be edited afterwards."}</p>
              <button className="btn" disabled={todo > 0}>Publish version {t.number}</button></form>
          )}
        </section>
        <section aria-labelledby="pv"><h2 id="pv" className="mb-2">Preview</h2><AgreementText text={t.body} />
          <p className="hint mt-4"><Link className="underline" href="/settings/terms">All versions</Link></p></section>
      </div>
    </>
  );
}
