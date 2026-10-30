import Link from "next/link";
import { FileText } from "lucide-react";
import { requireStaff } from "@/modules/identity/session";
import { legalOverview } from "@/modules/settings/service";
import { LEGAL } from "@/modules/settings/legal-docs";
import { SettingsNav } from "@/components/settings-nav";
import { RecordHeader, Status, fmtDate } from "@/components/ui";

export const metadata = { title: "Legal documents" };

const GROUPS = [
  { id: "customers", title: "Sent to customers during onboarding", about: "The Terms and Conditions are inside every agreement and are accepted when the customer signs. The Data Processing Agreement and Change Request are agreed with a customer when their work needs them." },
  { id: "website", title: "Shown on our own website (not sent to customers)", about: "What visitors to onesimplesite.co.uk see. The Cookie Notice has to match what the website really sets, so it needs a cookie scan of the live site before it is published." },
] as const;
export default async function LegalIndex() {
  const ctx = await requireStaff("settings.write");
  const docs = await legalOverview(ctx);
  return (
    <>
      <RecordHeader title="Settings" meta="Company details, legal documents and emails" />
      <SettingsNav current="legal" />
      <p className="mb-8 max-w-2xl text-sm text-muted">Each document is versioned: a published version never changes, and editing starts a new draft. Wording starts as a draft with <strong>[TBC: …]</strong> marks for anything still to decide, and a document can't be published until they are all filled in.</p>
      {GROUPS.map((g) => (
        <section key={g.id} className="mb-10" aria-labelledby={`g-${g.id}`}>
          <h2 id={`g-${g.id}`} className="text-lg">{g.title}</h2>
          <p className="mb-4 mt-1 max-w-2xl text-sm text-muted">{g.about}</p>
          <ul className="grid gap-4 md:grid-cols-2">
            {docs.filter((d) => LEGAL[d.kind].group === g.id).map(({ kind, published, latest, todo }) => {
              const m = LEGAL[kind];
              return (
                <li key={kind} className="rounded-2xl border border-line p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3"><span className="mt-0.5 rounded-lg bg-soft p-2"><FileText size={18} aria-hidden /></span>
                      <div className="min-w-0"><h3 className="text-base font-semibold">{m.label}</h3><p className="text-xs text-muted">{m.ref}</p></div></div>
                    <Status label={published ? `v${published.number} live` : "not published"} kind={published ? "good" : "warn"} />
                  </div>
                  <p className="mt-3 text-sm text-muted">{m.purpose}</p>
                  <p className="mt-2 text-sm">{todo > 0 ? <span className="text-warn">{todo} thing{todo > 1 ? "s" : ""} still to decide</span> : published ? <span className="text-muted">Published {published.publishedAt && fmtDate(published.publishedAt)}</span> : latest ? <span className="text-muted">Draft ready to publish</span> : null}</p>
                  {(kind === "dpa" || kind === "change_request") && <p className="mt-2 text-xs text-muted">Template only for now. The system can't yet fill this in for a customer and send it.</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {latest && <Link className="btn" href={`/settings/legal/${kind}/${latest.id}`}>{latest.status === "draft" ? "Edit draft" : "Open"}</Link>}
                    <Link className="btn btn-quiet" href={`/settings/legal/${kind}`}>All versions</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
