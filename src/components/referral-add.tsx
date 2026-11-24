import { db } from "@/lib/db";
import { SheetButton } from "./sheet-button";
import { addReferralAction } from "@/app/actions/referrals";

/** The quick way to record someone a customer or partner sent us. Lives in the hero of Referrals. */
export async function ReferralAdd({ workspaceId, back }: { workspaceId: string; back: string }) {
  const [customers, partners] = await Promise.all([
    db.customer.findMany({ where: { workspaceId, archivedAt: null }, orderBy: { displayName: "asc" }, take: 300, select: { id: true, displayName: true } }),
    db.partner.findMany({ where: { workspaceId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <SheetButton label="Add a referral" title="Add a referral" className="bill-pay">
      <form action={addReferralAction} className="space-y-3">
        <input type="hidden" name="back" value={back} />
        <div><label className="label" htmlFor="ar-r">Who sent them</label>
          <select id="ar-r" name="referrer" className="field" defaultValue="" required><option value="" disabled>Choose…</option>
            {partners.length > 0 && <optgroup label="Partners">{partners.map((o) => <option key={o.id} value={`p:${o.id}`}>{o.name}</option>)}</optgroup>}
            <optgroup label="Customers">{customers.map((o) => <option key={o.id} value={`c:${o.id}`}>{o.displayName}</option>)}</optgroup></select></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="ar-b">Their company</label><input id="ar-b" name="business" className="field" required autoComplete="off" /></div>
          <div><label className="label" htmlFor="ar-n">Their name</label><input id="ar-n" name="name" className="field" required autoComplete="off" /></div>
          <div><label className="label" htmlFor="ar-e">Email</label><input id="ar-e" name="email" type="email" className="field" required autoComplete="off" /></div>
          <div><label className="label" htmlFor="ar-p">Phone <span className="text-muted">(optional)</span></label><input id="ar-p" name="phone" type="tel" className="field" autoComplete="off" /></div>
        </div>
        <button className="btn">Add referral</button>
      </form>
    </SheetButton>
  );
}
