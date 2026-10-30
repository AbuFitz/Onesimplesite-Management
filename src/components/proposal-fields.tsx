import { money } from "./ui";
import { REQUIREMENT_FIELDS } from "@/modules/sales/service";

type Line = { description: string; quantity: number; unitMinor: number; recurring: boolean };
export function ProposalFields({ initial }: { initial?: { title: string; scope: string; terms: string; validUntil?: Date | null; recurringPeriod?: string | null; lines: Line[]; requirements?: Record<string, string | undefined> | null } }) {
  const rows = Array.from({ length: 6 }, (_, i) => initial?.lines[i]);
  return (
    <>
      <div><label className="label" htmlFor="title">Title</label><input id="title" name="title" className="field" defaultValue={initial?.title} required /></div>
      <div><label className="label" htmlFor="scope">Scope, deliverables and exclusions</label><textarea id="scope" name="scope" className="field min-h-40" defaultValue={initial?.scope} required /></div>
      <div><label className="label" htmlFor="terms">Deal-specific terms (optional)</label><textarea id="terms" name="terms" className="field" defaultValue={initial?.terms} /><p className="hint mt-1">Anything unique to this deal. Our standard Terms &amp; Conditions are attached automatically.</p></div>
      <fieldset className="space-y-3"><legend className="label">Website requirements (filled in for each deal)</legend>
        {REQUIREMENT_FIELDS.map(([k, label]) => (
          <div key={k}><label className="hint" htmlFor={`req_${k}`}>{label}</label><textarea id={`req_${k}`} name={`req_${k}`} className="field min-h-20" defaultValue={initial?.requirements?.[k]} /></div>
        ))}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="validUntil">Valid until</label><input id="validUntil" name="validUntil" type="date" className="field" defaultValue={initial?.validUntil?.toISOString().slice(0, 10)} /><p className="hint">Defaults to 30 days after sending.</p></div>
        <div><label className="label" htmlFor="rp">Recurring period</label><select id="rp" name="recurringPeriod" className="field" defaultValue={initial?.recurringPeriod ?? ""}><option value="">None</option><option value="month">Monthly</option><option value="year">Annual</option></select></div>
      </div>
      <fieldset><legend className="label">Pricing lines (GBP, one-off and recurring shown separately)</legend>
        <div className="space-y-3">
          {rows.map((l, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_5rem_8rem_auto] sm:items-end">
              <div><label className="hint" htmlFor={`l${i}d`}>Line {i + 1} description</label><input id={`l${i}d`} name={`l${i}d`} className="field" defaultValue={l?.description} /></div>
              <div><label className="hint" htmlFor={`l${i}q`}>Qty</label><input id={`l${i}q`} name={`l${i}q`} type="number" min={1} inputMode="numeric" className="field" defaultValue={l?.quantity ?? 1} /></div>
              <div><label className="hint" htmlFor={`l${i}p`}>Unit price £</label><input id={`l${i}p`} name={`l${i}p`} type="number" min={0} step="0.01" inputMode="decimal" className="field" defaultValue={l ? (l.unitMinor / 100).toFixed(2) : ""} /></div>
              <label className="flex items-center gap-2 min-h-11 text-sm"><input type="checkbox" name={`l${i}r`} defaultChecked={l?.recurring} /> Recurring</label>
            </div>
          ))}
        </div>
        {initial && <p className="hint mt-2">Saved totals: {money(initial.lines.filter((l) => !l.recurring).reduce((s, l) => s + l.quantity * l.unitMinor, 0))} one-off, {money(initial.lines.filter((l) => l.recurring).reduce((s, l) => s + l.quantity * l.unitMinor, 0))} recurring. VAT treatment is not applied until legal/VAT settings are configured.</p>}
      </fieldset>
    </>
  );
}
