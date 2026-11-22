"use client";
import { useState } from "react";

/**
 * How someone is rewarded, in plain words: a fixed amount, or a share of what the customer pays for the website.
 * A line underneath works out a real example so nobody has to guess what a percentage means.
 */
export function RewardPicker({ typeName, valueName, type = "fixed", value, allowDefault = false, label = "Reward" }: { typeName: string; valueName: string; type?: "fixed" | "percent" | ""; value?: number | null; allowDefault?: boolean; label?: string }) {
  const [t, setT] = useState<string>(type);
  const [v, setV] = useState<string>(value === null || value === undefined ? "" : String(value));
  const n = Number(v);
  const example = t === "percent" ? (n > 0 ? `A £1,500 website pays ${new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format((1500 * n) / 100)}.` : "") : t === "fixed" ? (n > 0 ? `Every website pays £${n}, whatever it costs.` : "") : "The default from Rules applies.";
  return (
    <div className="rp">
      <input type="hidden" name={typeName} value={t} />
      <div className="ab-seg" role="radiogroup" aria-label={label}>
        {allowDefault && <button type="button" role="radio" aria-checked={t === ""} className={t === "" ? "on" : ""} onClick={() => setT("")}>Default</button>}
        <button type="button" role="radio" aria-checked={t === "fixed"} className={t === "fixed" ? "on" : ""} onClick={() => setT("fixed")}>Fixed £</button>
        <button type="button" role="radio" aria-checked={t === "percent"} className={t === "percent" ? "on" : ""} onClick={() => setT("percent")}>Share of website %</button>
      </div>
      {t !== "" && (
        <div className="ab-money rp-in">{t === "fixed" && <span aria-hidden>£</span>}<input name={valueName} type="number" min="0" step="1" inputMode="decimal" className="field" aria-label={t === "percent" ? "Percent of the website price" : "Amount in pounds"} placeholder={t === "percent" ? "10" : "50"} value={v} onChange={(e) => setV(e.target.value)} />{t === "percent" && <span aria-hidden className="rp-pc">%</span>}</div>
      )}
      <p className="rp-ex">{example}</p>
    </div>
  );
}
