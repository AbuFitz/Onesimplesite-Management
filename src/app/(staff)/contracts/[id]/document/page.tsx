import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { DocSheet, DocBody } from "@/components/doc";
import { RecordHeader, Status } from "@/components/ui";

export const metadata = { title: "Agreement as sent" };
const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(d);

/** The exact words the customer was shown, frozen when it was sent. Always available, signed or not. */
export default async function AgreementAsSent({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaff("customer.read");
  const { id } = await params;
  const k = await db.contract.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: { customer: { select: { displayName: true, legalName: true } }, signingRequests: { orderBy: { createdAt: "desc" } } } });
  if (!k) notFound();
  const r = k.signingRequests.find((x) => x.status === "signed") ?? k.signingRequests[0];
  if (!r) notFound();
  const signed = r.status === "signed";
  return (
    <>
      <RecordHeader back={{ href: `/contracts/${k.id}`, label: "Back to the agreement" }} title={k.title} meta={`${k.reference} · sent to ${r.signerName} (${r.signerEmail})`}
        status={<Status label={signed ? "Signed" : r.status === "pending" ? "Waiting for signature" : r.status} kind={signed ? "good" : r.status === "pending" ? "warn" : "bad"} />}
        action={<a className="btn btn-quiet" href={signed ? `/contracts/${k.id}/pdf` : `/contracts/${k.id}/document/pdf`}>{signed ? "Signed PDF" : "PDF copy"}</a>} />
      <div role="note" className="mx-auto mb-5 max-w-[794px] rounded-2xl bg-[#e3effa] px-4 py-3 text-sm text-[#103a5c]">These are the exact words {r.signerName} {signed ? "signed" : "was sent"}. They are saved when the agreement is sent and never change.</div>
      <DocSheet meta={{ title: k.title, ref: k.reference, date: day(r.createdAt), version: "1.0", status: signed ? "Signed" : "Issued", mark: `Prepared for ${k.customer.legalName ?? k.customer.displayName}` }}>
        <DocBody text={r.contentText} hideSign={(l) => l.startsWith("Accepted by")} />
      </DocSheet>
    </>
  );
}
