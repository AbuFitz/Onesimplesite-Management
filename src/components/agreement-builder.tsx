"use client";
import { useMemo, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { PendingVeil } from "./wizard";

type Line = { description: string; quantity: number; unitMinor: number; recurring: boolean };
type Plan = { id: string; name: string; price: string; monthlyMinor: number };
type Init = { title: string; scope: string; terms: string; validUntil?: string; lines: Line[]; req: Record<string, string | undefined> };
const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n / 100);
const DEPOSITS = ["", "25", "30", "40", "50"];
const FREE = ["", "1", "2", "3", "6", "12"];

/**
 * One page, five short sections, and a live summary of what the customer will pay.
 * The website price is typed once. The monthly price can only come from the care plan you pick (no separate "repeats" ticks, so nothing is ever counted twice).
 */
export function AgreementBuilder({ init, plans, reqFields, projectTypes, canSend }: { init: Init; plans: Plan[]; reqFields: [string, string][]; projectTypes: { id: string; label: string }[]; canSend: boolean }) {
  const oneOffs = init.lines.filter((l) => !l.recurring);
  const legacyMonthly = init.lines.filter((l) => l.recurring && !plans.some((p) => p.name.toLowerCase() === l.description.toLowerCase()));
  const [items, setItems] = useState<{ d: string; p: string }[]>(oneOffs.length ? oneOffs.map((l) => ({ d: l.description, p: (l.unitMinor / 100).toFixed(2) })) : [{ d: "Website design and build", p: "" }]);
  const [plan, setPlan] = useState(init.req.plan ?? "");
  const [dep, setDep] = useState(init.req.depositPercent ?? "");
  const [offerOn, setOfferOn] = useState(!!(init.req.promoFreeMonths || init.req.promoPercent || init.req.promoDiscount));
  const [free, setFree] = useState(init.req.promoFreeMonths ?? "");
  const [pct, setPct] = useState(init.req.promoPercent ?? "");
  const [pound, setPound] = useState(init.req.promoDiscount ?? "");
  const [label, setLabel] = useState(init.req.promoLabel ?? "");
  const [ends, setEnds] = useState(init.req.promoFreeEnds === "stop");

  const s = useMemo(() => {
    const oneOff = items.reduce((n, i) => n + Math.round(Number(i.p || 0) * 100), 0);
    const chosen = plans.find((p) => p.id === plan);
    const monthly = (chosen?.monthlyMinor ?? 0) + legacyMonthly.reduce((n, l) => n + l.unitMinor * l.quantity, 0);
    const pctOff = offerOn ? Math.min(100, Math.max(0, Number(pct) || 0)) : 0;
    const off = offerOn ? Math.min(oneOff, Math.round((oneOff * pctOff) / 100) + Math.round((Number(pound) || 0) * 100)) : 0;
    const fee = Math.max(0, oneOff - off), d = Number(dep) || 0, deposit = d > 0 ? Math.round((fee * d) / 100) : 0, f = offerOn ? Number(free) || 0 : 0;
    return { oneOff, monthly, off, fee, d, deposit, free: f, chosen };
  }, [items, plan, dep, offerOn, free, pct, pound, plans, legacyMonthly]);

  const noPlanForFree = s.free > 0 && s.monthly === 0;
  return (
    <div className="ab">
      <PendingVeil text="Saving…" />
      <div className="ab-main">
        <section className="ab-sec" aria-labelledby="ab1"><h2 id="ab1">The job</h2>
          <label className="label" htmlFor="title">Name</label><input id="title" name="title" className="field" defaultValue={init.title} required />
          <label className="label" htmlFor="scope">What we are building</label><textarea id="scope" name="scope" rows={3} className="field" defaultValue={init.scope} required />
          <label className="label" htmlFor="pjt">Kind of project</label>
          <select id="pjt" name="projectType" className="field" defaultValue={init.req.projectType ?? "new_site"}>{projectTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
        </section>

        <section className="ab-sec" aria-labelledby="ab2"><h2 id="ab2">Price</h2>
          <div className="ab-lines">
            {items.map((it, i) => (
              <div key={i} className="ab-line">
                <input aria-label={`Item ${i + 1}`} name={`l${i}d`} className="field" placeholder="What it's for" value={it.d} onChange={(e) => setItems(items.map((x, n) => (n === i ? { ...x, d: e.target.value } : x)))} />
                <div className="ab-money"><span aria-hidden>£</span><input aria-label={`Price for item ${i + 1}`} name={`l${i}p`} inputMode="decimal" className="field" placeholder="0.00" value={it.p} onChange={(e) => setItems(items.map((x, n) => (n === i ? { ...x, p: e.target.value } : x)))} /></div>
                <input type="hidden" name={`l${i}q`} value="1" />
                {i > 0 && <button type="button" className="ab-x" aria-label="Remove this item" onClick={() => setItems(items.filter((_, n) => n !== i))}><X size={16} aria-hidden /></button>}
              </div>
            ))}
            {legacyMonthly.map((l, k) => (
              <div key={`m${k}`} className="ab-line ab-legacy"><input className="field" name={`l${items.length + k}d`} defaultValue={l.description} aria-label="Monthly item" /><div className="ab-money"><span aria-hidden>£</span><input className="field" name={`l${items.length + k}p`} defaultValue={(l.unitMinor / 100).toFixed(2)} aria-label="Monthly price" /></div><input type="hidden" name={`l${items.length + k}q`} value={l.quantity} /><input type="hidden" name={`l${items.length + k}r`} value="on" /><em>a month</em></div>
            ))}
          </div>
          {items.length + legacyMonthly.length < 8 && <button type="button" className="ab-add" onClick={() => setItems([...items, { d: "", p: "" }])}><Plus size={15} aria-hidden /> Add another one-off item</button>}
          <input type="hidden" name="recurringPeriod" value="month" />
          <p className="ab-sub">Monthly care plan</p>
          <input type="hidden" name="plan" value={plan} />
          <div className="ab-plans" role="radiogroup" aria-label="Care plan">
            <button type="button" role="radio" aria-checked={plan === ""} className={plan === "" ? "on" : ""} onClick={() => setPlan("")}><b>No care plan</b><small>Website only</small></button>
            {plans.map((p) => <button key={p.id} type="button" role="radio" aria-checked={plan === p.id} className={plan === p.id ? "on" : ""} onClick={() => setPlan(p.id)}><b>{p.name}</b><small>{p.price} a month</small>{plan === p.id && <Check size={16} aria-hidden />}</button>)}
          </div>
        </section>

        <section className="ab-sec" aria-labelledby="ab3"><h2 id="ab3">How they pay</h2>
          <input type="hidden" name="depositPercent" value={dep} />
          <div className="ab-seg" role="radiogroup" aria-label="Deposit">
            {DEPOSITS.map((d) => <button key={d || "none"} type="button" role="radio" aria-checked={dep === d} className={dep === d ? "on" : ""} onClick={() => setDep(d)}>{d ? `${d}% deposit` : "All after signing"}</button>)}
          </div>
          <p className="ab-hint">{s.fee <= 0 ? "Nothing to pay for the website." : s.d > 0 ? `${gbp(s.deposit)} when they sign, then ${gbp(s.fee - s.deposit)} before the site goes live.` : `${gbp(s.fee)} due after they sign.`}</p>
        </section>

        <section className="ab-sec" aria-labelledby="ab4"><h2 id="ab4">Offer <span>optional</span></h2>
          <label className="ab-switch"><span>Offer for this company</span><span className="sw"><input type="checkbox" checked={offerOn} onChange={(e) => setOfferOn(e.target.checked)} /><i aria-hidden /></span></label>
          {offerOn && (
            <div className="ab-offer">
              <p className="ab-sub">Free months of care</p>
              <input type="hidden" name="promoFreeMonths" value={free} />
              <div className="ab-seg" role="radiogroup" aria-label="Free months">{FREE.map((m) => <button key={m || "none"} type="button" role="radio" aria-checked={free === m} className={free === m ? "on" : ""} onClick={() => setFree(m)}>{m ? `${m} mo` : "None"}</button>)}</div>
              {Number(free) > 0 && (
                <div className="ab-seg" role="radiogroup" aria-label="When the free months end">
                  <button type="button" role="radio" aria-checked={!ends} className={!ends ? "on" : ""} onClick={() => setEnds(false)}>Then carry on paid</button>
                  <button type="button" role="radio" aria-checked={ends} className={ends ? "on" : ""} onClick={() => setEnds(true)}>Then just end</button>
                </div>
              )}
              <input type="hidden" name="promoFreeEnds" value={ends ? "stop" : ""} />
              <p className="ab-sub">Off the website fee</p>
              <div className="ab-two"><div className="ab-money"><input name="promoPercent" inputMode="decimal" className="field" placeholder="0" value={pct} onChange={(e) => setPct(e.target.value)} aria-label="Percent off" /><span aria-hidden>%</span></div><div className="ab-money"><span aria-hidden>£</span><input name="promoDiscount" inputMode="decimal" className="field" placeholder="0" value={pound} onChange={(e) => setPound(e.target.value)} aria-label="Pounds off" /></div></div>
              <label className="label" htmlFor="pl">What to call it</label><input id="pl" name="promoLabel" className="field" placeholder="e.g. Launch offer" maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} />
              {noPlanForFree && <p className="ab-warn">Free months need a care plan to apply to. Pick one above.</p>}
            </div>
          )}
        </section>

        <details className="ab-sec ab-more"><summary>More details <span>optional</span></summary>
          <div className="ab-grid">
            {reqFields.map(([k, l]) => <div key={k} className={k === "payment" || k === "notes" ? "ab-full" : ""}><label className="label" htmlFor={`req_${k}`}>{l}</label><textarea id={`req_${k}`} name={`req_${k}`} rows={2} className="field" defaultValue={init.req[k]} /></div>)}
            <div className="ab-full"><label className="label" htmlFor="terms">Extra terms for this customer only</label><textarea id="terms" name="terms" rows={2} className="field" defaultValue={init.terms} /></div>
            <div><label className="label" htmlFor="validUntil">Open until</label><input id="validUntil" name="validUntil" type="date" className="field" defaultValue={init.validUntil} /></div>
          </div>
        </details>
      </div>

      <aside className="ab-side" aria-label="What the customer will pay">
        <p className="ab-sh">The customer pays</p>
        <dl>
          <div><dt>Website</dt><dd>{s.fee > 0 ? gbp(s.fee) : "£0"}{s.off > 0 && <small>was {gbp(s.oneOff)}</small>}</dd></div>
          {s.d > 0 && s.fee > 0 && <><div className="sub"><dt>On signing</dt><dd>{gbp(s.deposit)}</dd></div><div className="sub"><dt>Before launch</dt><dd>{gbp(s.fee - s.deposit)}</dd></div></>}
          <div><dt>Care plan</dt><dd>{s.chosen ? `${gbp(s.monthly)} / month` : s.monthly > 0 ? `${gbp(s.monthly)} / month` : "None"}{s.free > 0 && s.monthly > 0 && <small>{s.free} free {s.free === 1 ? "month" : "months"}{ends ? ", then ends" : ""}</small>}</dd></div>
        </dl>
        <div className="ab-act">
          <button type="submit" name="go" value="1" className="btn btn-quiet" formNoValidate>Save</button>
          <button type="submit" name="go" value="5" className="btn">{canSend ? "Review and send" : "Review"}</button>
        </div>
        <p className="ab-hint">Saved only when you press a button.</p>
      </aside>
    </div>
  );
}
