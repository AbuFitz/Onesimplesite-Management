import { notFound } from "next/navigation";
import { requireStaff } from "@/modules/identity/session";
import { getTerms, getCompany } from "@/modules/settings/service";
import { sampleAgreement } from "@/modules/settings/sample";
import { isLegalKind, LEGAL } from "@/modules/settings/legal-docs";
import { splitIntro } from "@/modules/settings/legal-starters";
import { AgreementText } from "@/components/agreement";
import { LegalSheet } from "@/components/legal-sheet";
import { RecordHeader, Status } from "@/components/ui";

export const metadata = { title: "Document preview" };
export default async function Preview({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const ctx = await requireStaff("settings.write");
  const { kind, id } = await params;
  if (!isLegalKind(kind)) notFound();
  const t = await getTerms(ctx, id);
  if (!t || t.kind !== kind) notFound();
  const m = LEGAL[kind];
  const isTerms = kind === "terms";
  const { intro, rest } = isTerms ? { intro: undefined, rest: "" } : splitIntro(t.body);
  const text = isTerms ? sampleAgreement(await getCompany(ctx), { number: t.number, body: t.body }) : rest;
  return (
    <>
      <RecordHeader back={{ href: `/settings/legal/${kind}/${t.id}`, label: "Back to editing" }} title="Document preview"
        meta={isTerms ? "Exactly what a customer reads and signs. The order details are made up." : "Exactly how this document looks when it is issued."}
        status={<Status label={t.status} kind={t.status === "published" ? "good" : "warn"} />}
        action={isTerms ? <a className="btn" href={`/settings/legal/terms/${t.id}/sample.pdf`}>Download sample PDF</a> : undefined} />
      <div className="-mx-4 rounded-2xl bg-[#e4e7e5] px-3 py-6 sm:mx-0 sm:px-8 sm:py-10">
        <LegalSheet meta={{ title: isTerms ? "Services Agreement" : t.title, ref: m.ref, version: `${t.number}.0`, status: t.status[0].toUpperCase() + t.status.slice(1), date: new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(t.publishedAt ?? t.updatedAt), audience: m.audience }} intro={intro}>
          <AgreementText text={text} />
        </LegalSheet>
      </div>
    </>
  );
}
