import { notFound } from "next/navigation";
import { requireStaff } from "@/modules/identity/session";
import { getCustomer, customerDetailsMissing } from "@/modules/crm/service";
import { updateDetailsAction } from "@/app/actions/crm";
import { RecordHeader, ErrorSummary } from "@/components/ui";

export const metadata = { title: "Customer details" };
export default async function Details({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const ctx = await requireStaff("customer.write");
  const { id } = await params;
  const c = await getCustomer(ctx, id);
  if (!c) notFound();
  const missing = customerDetailsMissing(c);
  return (
    <>
      <RecordHeader back={{ href: `/customers/${c.id}`, label: c.displayName }} title="Customer details" meta="Used as the “Client” on agreements" />
      <ErrorSummary message={(await searchParams).error} />
      {missing.length > 0 && <p className="mb-4 border-l-4 border-warn bg-wash px-3 py-2 text-sm"><strong>Needed before an agreement can be sent:</strong> {missing.join(", ")}.</p>}
      <form action={updateDetailsAction} className="max-w-xl space-y-4"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="version" value={c.version} />
        <div><label className="label" htmlFor="kind">Customer type</label><select id="kind" name="kind" className="field" defaultValue={c.kind}><option value="business">Company / business</option><option value="individual">Sole trader / individual</option></select></div>
        <div><label className="label" htmlFor="legalName">Legal name (company name, or full name for an individual)</label><input id="legalName" name="legalName" className="field" defaultValue={c.legalName ?? ""} /></div>
        <div><label className="label" htmlFor="companyNumber">Company number (companies only)</label><input id="companyNumber" name="companyNumber" className="field" defaultValue={c.companyNumber ?? ""} /></div>
        <div><label className="label" htmlFor="vatNumber">VAT number (only if VAT registered)</label><input id="vatNumber" name="vatNumber" className="field" defaultValue={c.vatNumber ?? ""} /></div>
        <div><label className="label" htmlFor="billingAddress">Registered / billing address</label><textarea id="billingAddress" name="billingAddress" className="field" autoComplete="street-address" defaultValue={c.billingAddress ?? ""} /></div>
        <div><label className="label" htmlFor="website">Website</label><input id="website" name="website" inputMode="url" className="field" defaultValue={c.website ?? ""} /></div>
        <div><label className="label" htmlFor="phone">Phone</label><input id="phone" name="phone" type="tel" className="field" defaultValue={c.phone ?? ""} /></div>
        <button className="btn">Save details</button>
      </form>
    </>
  );
}
