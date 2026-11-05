"use client";
import { useEffect, useRef, useState } from "react";

type Plan = { id: string; name: string; monthlyMinor: number };
const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n / 100);

/** What the customer will actually pay, in plain words, updating as the team fills the form in. So nobody has to guess what a tick or a dropdown will do. */
export function PaySummary({ plans }: { plans: Plan[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [v, setV] = useState<{ oneOff: number; monthly: number; fee: number; off: number; dep: number; free: number; ends: boolean; planName: string; pct: number } | null>(null);
  useEffect(() => {
    const form = box.current?.closest("form"); if (!form) return;
    const calc = () => {
      const fd = new FormData(form);
      let oneOff = 0, monthly = 0; const rec: string[] = [];
      for (let i = 0; i < 8; i++) {
        const d = String(fd.get(`l${i}d`) ?? "").trim(); if (!d) continue;
        const amt = Math.round(Number(fd.get(`l${i}p`) || 0) * 100) * (Number(fd.get(`l${i}q`) || 1) || 1);
        if (fd.get(`l${i}r`) === "on") { monthly += amt; rec.push(d.toLowerCase()); } else oneOff += amt;
      }
      const plan = plans.find((p) => p.id === String(fd.get("plan") ?? ""));
      if (plan && !rec.includes(plan.name.toLowerCase())) monthly += plan.monthlyMinor;     // the plan's own price is added for them
      const pctOff = Math.min(100, Math.max(0, Number(fd.get("promoPercent")) || 0));
      const off = Math.min(oneOff, Math.round((oneOff * pctOff) / 100) + Math.round((Number(fd.get("promoDiscount")) || 0) * 100));
      const fee = Math.max(0, oneOff - off);
      const pct = Number(fd.get("depositPercent")) || 0;
      setV({ oneOff, monthly, fee, off, dep: pct > 0 ? Math.round((fee * pct) / 100) : 0, free: Number(fd.get("promoFreeMonths")) || 0, ends: fd.get("promoFreeEnds") === "stop", planName: plan?.name ?? "", pct });
    };
    calc(); form.addEventListener("input", calc); form.addEventListener("change", calc);
    return () => { form.removeEventListener("input", calc); form.removeEventListener("change", calc); };
  }, [plans]);
  return (
    <div ref={box} role="region" aria-label="What the customer will pay" className="rounded-2xl border border-[#cfe9dd] bg-[#f3fbf7] p-4">
      <p className="text-sm font-bold text-[#0a5a3d]">What the customer will pay</p>
      {!v ? <p className="mt-1 text-sm text-muted">Fill in the prices above and this shows what it adds up to.</p> : (
        <ul className="mt-2 space-y-1.5 text-[15px]">
          <li><strong>Website:</strong> {v.fee > 0 ? gbp(v.fee) : "nothing to pay"}{v.off > 0 && <span className="text-muted"> (was {gbp(v.oneOff)}, {gbp(v.off)} off)</span>}
            {v.fee > 0 && (v.pct > 0 ? <span className="block text-sm text-muted">{gbp(v.dep)} when they sign ({v.pct}% deposit), then {gbp(v.fee - v.dep)} before the site goes live.</span> : <span className="block text-sm text-muted">All of it is due after they sign.</span>)}</li>
          <li><strong>Monthly care plan:</strong> {v.monthly > 0 ? (v.free > 0 ? (v.ends ? `free for ${v.free} month${v.free === 1 ? "" : "s"} from the day the site goes live, then it simply ends (no card, nothing charged)` : `${gbp(v.monthly)} a month, the first ${v.free} month${v.free === 1 ? "" : "s"} free from the day the site goes live`) : `${gbp(v.monthly)} a month, starting when the site goes live`) : "none"}
            {v.monthly > 0 && v.free > 0 && v.ends && <span className="block text-sm text-muted">{gbp(v.monthly)} a month only if they ask to carry on.</span>}</li>
          {v.free > 0 && v.monthly === 0 && <li className="rounded-lg bg-[#fbf3d5] px-3 py-2 text-sm font-semibold text-[#5c4700]">You've chosen free months but there's no care plan for them to apply to. Pick a care plan above, or take the free months off.</li>}
        </ul>
      )}
    </div>
  );
}
