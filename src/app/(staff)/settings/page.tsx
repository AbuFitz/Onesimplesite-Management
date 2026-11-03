import Link from "next/link";
import { requireStaff } from "@/modules/identity/session";
import { getCompany, companyMissing } from "@/modules/settings/service";
import { updateCompanyAction, createTestClientAction } from "@/app/actions/work";
import { SettingsNav } from "@/components/settings-nav";
import { RecordHeader, ErrorSummary } from "@/components/ui";

export const metadata = { title: "Settings" };
export default async function Settings({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; demo?: string }> }) {
  const ctx = await requireStaff("settings.write");
  const sp = await searchParams;
  const c = await getCompany(ctx);
  const missing = companyMissing(c);
  return (
    <>
      <RecordHeader title="Settings" meta="Company details, legal documents and emails" />
      <ErrorSummary message={sp.error} />
      {sp.demo && <p role="status" className="mb-4 text-sm text-moss">Test client ready. A portal invitation is on its way to that email. Open it to set a password and sign in.</p>}
      {sp.saved && <p role="status" className="mb-4 text-sm text-moss">Saved.</p>}
      <SettingsNav current="company" />
      <section aria-labelledby="co" className="max-w-xl">
        <h2 id="co" className="mb-1">Our company details</h2>
        <p className="hint mb-4">These appear as the “Provider” on every agreement. Nothing is filled in for you. Agreements can't be sent until the legal name and registered address are set.</p>
        {missing.length > 0 && <p className="mb-4 border-l-4 border-warn bg-wash px-3 py-2 text-sm"><strong>Still needed:</strong> {missing.join(", ")}.</p>}
        <form action={updateCompanyAction} className="space-y-4">
          <div><label className="label" htmlFor="legalName">Legal company name</label><input id="legalName" name="legalName" className="field" defaultValue={c.legalName ?? ""} /></div>
          <div><label className="label" htmlFor="companyNumber">Company number (if any)</label><input id="companyNumber" name="companyNumber" className="field" defaultValue={c.companyNumber ?? ""} /></div>
          <div><label className="label" htmlFor="registeredAddress">Registered address</label><textarea id="registeredAddress" name="registeredAddress" className="field" defaultValue={c.registeredAddress ?? ""} /></div>
          <div><label className="label" htmlFor="vatNumber">VAT number (leave empty: we are not VAT registered)</label><input id="vatNumber" name="vatNumber" className="field" defaultValue={c.vatNumber ?? ""} /></div>
          <button className="btn">Save company details</button>
        </form>
      </section>
      <section aria-labelledby="demo" className="mt-10 max-w-xl border-t border-line pt-6">
        <h2 id="demo" className="mb-1">Test client account</h2>
        <p className="hint mb-4">A demo business so you can try the client portal for real: sign in, see the project, raise a ticket, and pay the website fee and monthly plan with Stripe test cards. Use an email you can open. It can be the same address you use here if it isn't already a customer.</p>
        <form action={createTestClientAction} className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1"><label className="label" htmlFor="demo-email">Send the portal invitation to</label><input id="demo-email" name="email" type="email" className="field" autoComplete="email" required /></div>
          <button className="btn btn-quiet">Create test client</button>
        </form>
      </section>
    </>
  );
}
