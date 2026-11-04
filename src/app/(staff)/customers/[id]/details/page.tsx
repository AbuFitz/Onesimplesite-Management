import { notFound } from "next/navigation";
import { requireStaff } from "@/modules/identity/session";
import { getCustomer, customerDetailsMissing } from "@/modules/crm/service";
import { updateDetailsAction } from "@/app/actions/crm";
import { RecordHeader, ErrorSummary, Avatar } from "@/components/ui";
import { PhotoUpload } from "@/components/photo-upload";
import { removeLogoAction } from "@/app/actions/photo";

export const metadata = { title: "Company details" };
export default async function Details({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; logo?: string }> }) {
  const ctx = await requireStaff("customer.write");
  const { id } = await params;
  const c = await getCustomer(ctx, id);
  if (!c) notFound();
  const missing = customerDetailsMissing(c);
  return (
    <>
      <RecordHeader back={{ href: `/customers/${c.id}`, label: c.displayName }} title="Company details" meta="Used as the “Client” on agreements" />
      {(await searchParams).logo === "1" && <p role="status" className="mb-4 text-sm text-moss">Logo saved.</p>}
      <ErrorSummary message={(await searchParams).error} />
      <section aria-labelledby="lg" className="mb-8 flex max-w-xl flex-wrap items-center gap-4 rounded-xl border border-[var(--card-line)] bg-white p-4"><Avatar name={c.displayName} size={64} staffId={c.id} base="/api/logo" />
        <div className="min-w-0 flex-1"><h2 id="lg" className="text-base font-bold">Logo</h2><p className="text-sm text-muted">Only the team sees this. It helps you spot the company at a glance in lists and tickets.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2"><PhotoUpload logoFor={c.id} /><form action={removeLogoAction}><input type="hidden" name="customerId" value={c.id} /><button className="btn btn-quiet">Remove</button></form></div></div></section>
      {missing.length > 0 && <p className="mb-4 border-l-4 border-warn bg-wash px-3 py-2 text-sm"><strong>Needed before an agreement can be sent:</strong> {missing.join(", ")}.</p>}
      <form action={updateDetailsAction} className="max-w-xl space-y-4"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="version" value={c.version} />
        <div><label className="label" htmlFor="kind">Type</label><select id="kind" name="kind" className="field" defaultValue={c.kind}><option value="business">Limited company</option><option value="sole_trader">Sole trader</option><option value="individual">Individual</option></select></div>
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
