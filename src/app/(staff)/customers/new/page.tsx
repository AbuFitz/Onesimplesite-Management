import { requireStaff } from "@/modules/identity/session";
import { createLeadAction } from "@/app/actions/crm";
import { RecordHeader, ErrorSummary } from "@/components/ui";

export const metadata = { title: "New enquiry" };
export default async function NewLead({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireStaff("customer.write");
  const { error } = await searchParams;
  return (
    <>
      <RecordHeader back={{ href: "/customers", label: "Customers" }} title="New enquiry" />
      <ErrorSummary message={error} />
      <form action={createLeadAction} className="max-w-xl space-y-4">
        <p className="hint">Only a business name and contact name are required. Billing and legal details can come later.</p>
        <div><label className="label" htmlFor="displayName">Business or client name</label><input id="displayName" name="displayName" className="field" required /></div>
        <div><label className="label" htmlFor="contactName">Contact name</label><input id="contactName" name="contactName" className="field" autoComplete="off" required /></div>
        <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" inputMode="email" className="field" /></div>
        <div><label className="label" htmlFor="phone">Phone</label><input id="phone" name="phone" type="tel" inputMode="tel" className="field" /></div>
        <div><label className="label" htmlFor="source">Where did they hear of us?</label><input id="source" name="source" className="field" /></div>
        <div><label className="label" htmlFor="note">Internal note</label><textarea id="note" name="note" className="field" /><p className="hint">Internal only. Never shown to the client.</p></div>
        <button className="btn">Save enquiry</button>
      </form>
    </>
  );
}
