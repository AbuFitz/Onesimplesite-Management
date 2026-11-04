import { money } from "./ui";
import { PriceLines } from "./price-lines";
import { REQUIREMENT_FIELDS } from "@/modules/sales/service";
import { PROJECT_TYPES } from "@/modules/projects/service";

type Line = { description: string; quantity: number; unitMinor: number; recurring: boolean };
type Initial = { title: string; scope: string; terms: string; validUntil?: Date | null; recurringPeriod?: string | null; lines: Line[]; requirements?: Record<string, string | undefined> | null };

/** The short version first: name, what it covers, the price. Everything else is tucked under "More details". */
export function ProposalFields({ initial, defaults, plans = [] }: { initial?: Initial; defaults?: { title: string; scope: string }; plans?: { id: string; name: string; price: string }[] }) {
  const filledReqs = REQUIREMENT_FIELDS.filter(([k]) => initial?.requirements?.[k]).length;
  return (
    <>
      <div><label className="label" htmlFor="title">Name</label><input id="title" name="title" className="field" defaultValue={initial?.title ?? defaults?.title} required /></div>
      <div><label className="label" htmlFor="scope">What we are building</label><textarea id="scope" name="scope" className="field min-h-24" defaultValue={initial?.scope ?? defaults?.scope} required /></div>
      <PriceLines lines={initial?.lines ?? []} />
      {plans.length > 0 && <div><label className="label" htmlFor="plan">Care plan</label><select id="plan" name="plan" className="field" defaultValue={initial?.requirements?.plan ?? ""}><option value="">No care plan</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}, {p.price} a month</option>)}</select><p className="hint mt-1">Choosing a plan adds its monthly price and brings the Service Level Agreement and Hosting terms into the pack.</p></div>}
      <div><label className="label" htmlFor="pjt">What kind of project is it?</label><select id="pjt" name="projectType" className="field" defaultValue={initial?.requirements?.projectType ?? "new_site"}>{Object.entries(PROJECT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select><p className="hint mt-1">Decides the steps and usual tasks on the project that's created when they sign. You can change it later.</p></div>
      <fieldset className="rounded-xl border border-line p-4"><legend className="px-1 text-sm font-semibold">Offer for this company <span className="font-normal text-muted">(optional)</span></legend>
        <p className="mb-3 text-sm text-muted">A promotion just for them. It is written into the order they sign, and the free months and discount are applied automatically when they pay.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className="label" htmlFor="pfm">Free months on the monthly plan</label><select id="pfm" name="promoFreeMonths" className="field" defaultValue={initial?.requirements?.promoFreeMonths ?? ""}><option value="">None</option>{["1", "2", "3", "6", "12"].map((n) => <option key={n} value={n}>{n} month{n === "1" ? "" : "s"} free</option>)}</select></div>
          <div><label className="label" htmlFor="pd">Discount on the website fee (£)</label><input id="pd" name="promoDiscount" inputMode="decimal" className="field" placeholder="0" defaultValue={initial?.requirements?.promoDiscount ?? ""} /></div>
          <div><label className="label" htmlFor="pl">What to call it</label><input id="pl" name="promoLabel" className="field" placeholder="e.g. Launch offer" maxLength={60} defaultValue={initial?.requirements?.promoLabel ?? ""} /></div>
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="rp">Repeating items are charged</label><select id="rp" name="recurringPeriod" className="field" defaultValue={initial?.recurringPeriod ?? ""}><option value="">Not applicable</option><option value="month">Monthly</option><option value="year">Yearly</option></select></div>
      </div>
      <details className="rounded-xl border border-line px-4 py-3" open={filledReqs > 0}>
        <summary className="cursor-pointer text-sm font-semibold">More details <span className="font-normal text-muted">· website requirements, payment plan, extra terms{filledReqs ? ` (${filledReqs} filled)` : ""}</span></summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {REQUIREMENT_FIELDS.map(([k, label]) => (
            <div key={k} className={k === "payment" || k === "notes" ? "sm:col-span-2" : ""}>
              <label className="hint" htmlFor={`req_${k}`}>{label}</label>
              <textarea id={`req_${k}`} name={`req_${k}`} rows={2} className="field" defaultValue={initial?.requirements?.[k]} />
            </div>
          ))}
          <div className="sm:col-span-2"><label className="hint" htmlFor="terms">Extra terms for this customer only</label><textarea id="terms" name="terms" rows={2} className="field" defaultValue={initial?.terms} /><p className="hint mt-1">Our standard Services Agreement is always included.</p></div>
          <div><label className="hint" htmlFor="validUntil">Offer open until</label><input id="validUntil" name="validUntil" type="date" className="field" defaultValue={initial?.validUntil?.toISOString().slice(0, 10)} /><p className="hint">Leave blank for 30 days after sending.</p></div>
        </div>
      </details>
      {initial && <p className="hint">Saved totals: {money(initial.lines.filter((l) => !l.recurring).reduce((s, l) => s + l.quantity * l.unitMinor, 0))} one-off, {money(initial.lines.filter((l) => l.recurring).reduce((s, l) => s + l.quantity * l.unitMinor, 0))} repeating.</p>}
    </>
  );
}
