import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { requireStaff } from "@/modules/identity/session";
import { getTerms, getCompany } from "@/modules/settings/service";
import { sampleAgreement } from "@/modules/settings/sample";
import { AgreementText } from "@/components/agreement";
import { RecordHeader, Status } from "@/components/ui";

export const metadata = { title: "Document preview" };
export default async function Preview({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaff("settings.write");
  const { id } = await params;
  const t = await getTerms(ctx, id);
  if (!t) notFound();
  const text = sampleAgreement(await getCompany(ctx), { number: t.number, body: t.body });
  return (
    <>
      <RecordHeader back={{ href: `/settings/terms/${t.id}`, label: "Back to editing" }} title="Document preview" meta="Exactly what a customer reads and signs. The order details are made up."
        status={<Status label={t.status} kind={t.status === "published" ? "good" : "warn"} />}
        action={<a className="btn" href={`/settings/terms/${t.id}/sample.pdf`}>Download sample PDF</a>} />
      <div className="-mx-4 rounded-2xl bg-[#eef0ee] px-3 py-6 sm:mx-0 sm:px-8 sm:py-10">
        <article className="mx-auto max-w-[794px] rounded-sm bg-white px-6 py-8 shadow-[0_2px_24px_rgba(14,19,17,.12)] sm:px-14 sm:py-14">
          <Image src="/brand/wordmark-colour.svg" alt="OneSimpleSite" width={140} height={29} className="mb-8" />
          <AgreementText text={text} />
          <div className="mt-10 border-t border-line pt-6 text-sm text-muted">
            <p className="font-semibold text-ink">Signature</p>
            <p>Signed electronically by the client on the day they sign. Their name, drawn signature, time and consent are added here.</p>
          </div>
        </article>
        <p className="mt-4 text-center text-xs text-muted">Page layout on paper may break differently. <Link className="underline" href={`/settings/terms/${t.id}/sample.pdf`}>Open the sample PDF</Link> for the exact printed pages.</p>
      </div>
    </>
  );
}
