"use client";
import { useState } from "react";

type Line = { description: string; quantity: number; unitMinor: number; recurring: boolean };
const MAX = 8;

/** Starts with the lines already saved (or two blank ones); more are added on request. */
export function PriceLines({ lines }: { lines: Line[] }) {
  const [count, setCount] = useState(Math.max(2, lines.length));
  return (
    <fieldset>
      <legend className="label">Price (£)</legend>
      <div className="space-y-2">
        {Array.from({ length: count }, (_, i) => lines[i]).map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_6.5rem] gap-2 sm:grid-cols-[1fr_7rem_auto] sm:items-center">
            <input aria-label={`Item ${i + 1}`} name={`l${i}d`} className="field" placeholder={i === 0 ? "Website design and build" : "Hosting and maintenance"} defaultValue={l?.description} />
            <input aria-label={`Price for item ${i + 1}`} name={`l${i}p`} type="number" min={0} step="0.01" inputMode="decimal" className="field" placeholder="0.00" defaultValue={l ? (l.unitMinor / 100).toFixed(2) : ""} />
            <label className="col-span-2 flex min-h-9 items-center gap-2 text-sm text-muted sm:col-span-1"><input type="checkbox" name={`l${i}r`} defaultChecked={l?.recurring} />Repeats</label>
            <input type="hidden" name={`l${i}q`} value={l?.quantity ?? 1} />
          </div>
        ))}
      </div>
      {count < MAX && <button type="button" className="mt-2 text-sm underline" onClick={() => setCount(count + 1)}>Add another item</button>}
    </fieldset>
  );
}
