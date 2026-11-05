import { PriceLines } from "./price-lines";
import { PaySummary } from "./pay-summary";
import { REQUIREMENT_FIELDS } from "@/modules/sales/service";
import { PROJECT_TYPES } from "@/modules/projects/service";

type Line = { description: string; quantity: number; unitMinor: number; recurring: boolean };
type Initial = { title: string; scope: string; terms: string; validUntil?: Date | null; recurringPeriod?: string | null; lines: Line[]; requirements?: Record<string, string | undefined> | null };

export const STEPS = [
  { n: 1, name: "The job", help: "What are we building, and for whom?" },
  { n: 2, name: "Price", help: "What does it cost? Set the website price and pick a care plan." },
  { n: 3, name: "Payment and offer", help: "How do they pay, and is there an offer for this company?" },
  { n: 4, name: "Details", help: "What the customer expects: pages, features, timeline. Optional, but it makes the agreement clearer." },
  { n: 5, name: "Check and send", help: "Look it over, preview it exactly as they will see it, then send." },
] as const;

/** One step at a time. Every field stays on the page (only the current step is shown), so the live summary always adds up and one Save keeps everything. */
export function ProposalFields({ initial, defaults, plans = [], step = 1 }: { initial?: Initial; defaults?: { title: string; scope: string }; plans?: { id: string; name: string; price: string; monthlyMinor: number }[]; step?: number }) {
  const hint = (n: number) => <p className="mb-5 text-[15px] text-muted">{STEPS[n - 1].help}</p>;
  return (
    <>
      <div hidden={step !== 1} className="space-y-4">
        <h2 className="text-xl">Step 1: The job</h2>{hint(1)}
        <div><label className="label" htmlFor="title">Name of the agreement</label><input id="title" name="title" className="field" defaultValue={initial?.title ?? defaults?.title} required={step === 1} /><p className="hint mt-1">The customer sees this at the top of their agreement.</p></div>
        <div><label className="label" htmlFor="scope">What we are building</label><textarea id="scope" name="scope" className="field min-h-28" defaultValue={initial?.scope ?? defaults?.scope} required={step === 1} /><p className="hint mt-1">A plain summary in a sentence or two.</p></div>
        <div><label className="label" htmlFor="pjt">Kind of project</label><select id="pjt" name="projectType" className="field" defaultValue={initial?.requirements?.projectType ?? "new_site"}>{Object.entries(PROJECT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select><p className="hint mt-1">Chosen when you started. Only change it if the job changed.</p></div>
      </div>

      <div hidden={step !== 2} className="space-y-4">
        <h2 className="text-xl">Step 2: Price</h2>{hint(2)}
        <PriceLines lines={initial?.lines ?? []} />
        <input type="hidden" name="recurringPeriod" value={initial?.recurringPeriod ?? "month"} />
        {plans.length > 0 && <div><label className="label" htmlFor="plan">Care plan</label><select id="plan" name="plan" className="field" defaultValue={initial?.requirements?.plan ?? ""}><option value="">No care plan (website only)</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}, {p.price} a month</option>)}</select><p className="hint mt-1">Choosing a plan adds its monthly price for you and brings the Service Level Agreement and Hosting terms into the agreement.</p></div>}
      </div>

      <div hidden={step !== 3} className="space-y-4">
        <h2 className="text-xl">Step 3: Payment and offer</h2>{hint(3)}
        <div><label className="label" htmlFor="dp">Deposit due when they sign</label><select id="dp" name="depositPercent" className="field" defaultValue={initial?.requirements?.depositPercent ?? ""}><option value="">No deposit, pay the website fee in one go</option>{["10", "20", "25", "30", "40", "50", "60", "70", "75"].map((n) => <option key={n} value={n}>{n}% deposit, the rest before launch</option>)}</select><p className="hint mt-1">Written into the agreement they sign, so there are no surprises. The two payments are created for you once they sign.</p></div>
        <fieldset className="rounded-xl border border-line p-4"><legend className="px-1 text-sm font-semibold">Offer for this company <span className="font-normal text-muted">(optional, leave empty for none)</span></legend>
          <p className="mb-3 text-sm text-muted">A promotion just for them. It is written into the agreement, and applied automatically when they pay.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><label className="label" htmlFor="pfm">Free months on the care plan</label><select id="pfm" name="promoFreeMonths" className="field" defaultValue={initial?.requirements?.promoFreeMonths ?? ""}><option value="">None</option>{["1", "2", "3", "6", "12"].map((n) => <option key={n} value={n}>{n} month{n === "1" ? "" : "s"} free</option>)}</select></div>
            <div><label className="label" htmlFor="pp">Percent off the website fee (%)</label><input id="pp" name="promoPercent" inputMode="decimal" className="field" placeholder="e.g. 10" defaultValue={initial?.requirements?.promoPercent ?? ""} /></div>
            <div><label className="label" htmlFor="pd">Or pounds off (£)</label><input id="pd" name="promoDiscount" inputMode="decimal" className="field" placeholder="0" defaultValue={initial?.requirements?.promoDiscount ?? ""} /></div>
            <div><label className="label" htmlFor="pl">What to call it</label><input id="pl" name="promoLabel" className="field" placeholder="e.g. Launch offer" maxLength={60} defaultValue={initial?.requirements?.promoLabel ?? ""} /></div>
          </div>
          <div className="mt-4 max-w-xl"><label className="label" htmlFor="pfe">When the free months end</label>
            <select id="pfe" name="promoFreeEnds" className="field" defaultValue={initial?.requirements?.promoFreeEnds ?? ""}>
              <option value="">Carry on as the paid monthly plan (they enter a card, first payment after the free months)</option>
              <option value="stop">Just end, nothing charged (no card needed, they can ask to continue)</option>
            </select><p className="hint mt-1">Pick “just end” for someone who wants to look after the site themselves. Only used when free months are chosen.</p></div>
        </fieldset>
      </div>

      <div hidden={step !== 4} className="space-y-4">
        <h2 className="text-xl">Step 4: Details</h2>{hint(4)}
        <div className="grid gap-3 sm:grid-cols-2">
          {REQUIREMENT_FIELDS.map(([k, label]) => (
            <div key={k} className={k === "payment" || k === "notes" ? "sm:col-span-2" : ""}>
              <label className="label" htmlFor={`req_${k}`}>{label}</label>
              <textarea id={`req_${k}`} name={`req_${k}`} rows={2} className="field" defaultValue={initial?.requirements?.[k]} />
            </div>
          ))}
          <div className="sm:col-span-2"><label className="label" htmlFor="terms">Extra terms for this customer only</label><textarea id="terms" name="terms" rows={2} className="field" defaultValue={initial?.terms} /><p className="hint mt-1">Our standard Services Agreement is always included.</p></div>
          <div><label className="label" htmlFor="validUntil">Offer open until</label><input id="validUntil" name="validUntil" type="date" className="field" defaultValue={initial?.validUntil?.toISOString().slice(0, 10)} /><p className="hint mt-1">Leave blank for 30 days after sending.</p></div>
        </div>
      </div>

      <div hidden={step !== 2 && step !== 3}><PaySummary plans={plans.map((p) => ({ id: p.id, name: p.name, monthlyMinor: p.monthlyMinor }))} /></div>
    </>
  );
}
