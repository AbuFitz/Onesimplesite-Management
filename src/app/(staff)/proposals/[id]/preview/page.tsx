import Link from "next/link";
import { requireStaff } from "@/modules/identity/session";
import { previewAgreement } from "@/modules/signing/service";
import { DocSheet, DocBody } from "@/components/doc";
import { RecordHeader } from "@/components/ui";
import { notFound } from "next/navigation";

export const metadata = { title: "Preview agreement" };
const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(d);

/** The agreement exactly as the customer will see it, before anything is sent. */
export default async function PreviewAgreement({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaff("customer.read");
  const { id } = await params;
  const r = await previewAgreement(ctx, id).catch(() => null);
  if (!r) notFound();
  return (
    <>
      <RecordHeader back={{ href: `/proposals/${id}`, label: "Back to the agreement" }} title="Preview" meta={`${r.title} · ${r.reference}`}
        action={<a className="btn btn-quiet" href={`/proposals/${id}/preview/pdf`}>Download PDF preview</a>} />
      <div role="note" className="mx-auto mb-5 max-w-[794px] rounded-2xl bg-[#fbf3d5] px-4 py-3 text-sm text-[#5c4700]">
        <strong>Nothing has been sent.</strong> {r.status === "draft" ? <>This is your last saved version, exactly as {r.signerName} will see it when you press Send. If you've just changed something, save it first and refresh.</> : <>This agreement has already been sent. See the signed copy on its agreement page.</>}
        {r.draftWording && <> <strong>Some documents are still drafts, so publish them before sending.</strong></>}
      </div>
      {r.blockers.length > 0 && (
        <div role="alert" className="mx-auto mb-5 max-w-[794px] rounded-2xl border border-[#e6c2c2] bg-[#fbeaea] px-4 py-3 text-sm text-[#7a1f1f]">
          <p className="font-semibold">Still needed before you can send it:</p>
          <ul className="mt-1 list-disc pl-5">{r.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
        </div>
      )}
      <DocSheet meta={{ title: r.title, ref: r.reference, date: day(new Date()), version: "1.0", status: "Preview", mark: `Prepared for ${r.business}` }}>
        <DocBody text={r.contentText} hideSign={(l) => l.startsWith("Accepted by")} />
      </DocSheet>
      <p className="mx-auto mt-5 max-w-[794px] text-sm"><Link className="underline" href={`/proposals/${id}`}>Back to the agreement</Link></p>
    </>
  );
}
