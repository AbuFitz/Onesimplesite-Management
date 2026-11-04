import Link from "next/link";
import { requireStaff } from "@/modules/identity/session";
import { db } from "@/lib/db";
import { AgreementCreateForm } from "@/components/agreement-create-form";
import { RecordHeader } from "@/components/ui";

export const metadata = { title: "New agreement" };

export default async function NewAgreement({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const ctx = await requireStaff("customer.write");
  const sp = await searchParams;
  const companies = await db.customer.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { displayName: "asc" }, select: { id: true, displayName: true, reference: true }, take: 500 });
  const biz = companies.find((b) => b.id === sp.business);
  const people = biz ? await db.contact.findMany({ where: { customerId: biz.id }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }], select: { id: true, name: true, position: true } }) : [];
  return (
    <>
      <RecordHeader back={{ href: "/agreements", label: "Agreements" }} title="New agreement" meta={biz ? biz.displayName : "Start by choosing the company"} />
      {!biz ? (
        <div className="max-w-xl space-y-6">
          <form className="space-y-3"><label className="label" htmlFor="b">Which company is it for?</label>
            <select id="b" name="business" className="field" required defaultValue="">{<option value="" disabled>Choose a company</option>}{companies.map((b) => <option key={b.id} value={b.id}>{b.displayName} ({b.reference})</option>)}</select>
            <button className="btn">Continue</button></form>
          <p className="rounded-xl bg-bone px-4 py-3 text-sm">New customer? <Link className="font-semibold underline" href="/customers/new">Add the company first</Link>, then start their agreement straight after.</p>
        </div>
      ) : <AgreementCreateForm customer={{ id: biz.id, name: biz.displayName }} people={people} />}
    </>
  );
}
