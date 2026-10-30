import Link from "next/link";
import { requireStaff } from "@/modules/identity/session";
import { getCompany, companyMissing } from "@/modules/settings/service";
import { updateCompanyAction } from "@/app/actions/work";
import { RecordHeader, ErrorSummary } from "@/components/ui";

export const metadata = { title: "Settings" };
export default async function Settings({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const ctx = await requireStaff("settings.write");
  const sp = await searchParams;
  const c = await getCompany(ctx);
  const missing = companyMissing(c);
  return (
    <>
      <RecordHeader title="Settings" meta="Company details and Terms & Conditions" />
      <ErrorSummary message={sp.error} />
      {sp.saved && <p role="status" className="mb-4 text-sm text-moss">Saved.</p>}
      <nav aria-label="Settings sections" className="mb-8 flex gap-2"><Link className="btn" href="/settings">Company details</Link><Link className="btn btn-quiet" href="/settings/terms">Terms &amp; Conditions</Link><Link className="btn btn-quiet" href="/settings/emails">Emails</Link></nav>
      <section aria-labelledby="co" className="max-w-xl">
        <h2 id="co" className="mb-1">Our company details</h2>
        <p className="hint mb-4">These appear as the “Provider” on every agreement. Nothing is filled in for you. Agreements can't be sent until the legal name and registered address are set.</p>
        {missing.length > 0 && <p className="mb-4 border-l-4 border-warn bg-wash px-3 py-2 text-sm"><strong>Still needed:</strong> {missing.join(", ")}.</p>}
        <form action={updateCompanyAction} className="space-y-4">
          <div><label className="label" htmlFor="legalName">Legal company name</label><input id="legalName" name="legalName" className="field" defaultValue={c.legalName ?? ""} /></div>
          <div><label className="label" htmlFor="companyNumber">Company number (if any)</label><input id="companyNumber" name="companyNumber" className="field" defaultValue={c.companyNumber ?? ""} /></div>
          <div><label className="label" htmlFor="registeredAddress">Registered address</label><textarea id="registeredAddress" name="registeredAddress" className="field" defaultValue={c.registeredAddress ?? ""} /></div>
          <div><label className="label" htmlFor="vatNumber">VAT number (only if VAT registered)</label><input id="vatNumber" name="vatNumber" className="field" defaultValue={c.vatNumber ?? ""} /></div>
          <button className="btn">Save company details</button>
        </form>
      </section>
    </>
  );
}
