"use client";
import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { checkStripeAction, type StripeCheck } from "@/app/actions/testing";

export function StripeCheckButton() {
  const [pending, start] = useTransition();
  const [r, setR] = useState<StripeCheck | null>(null);
  return (
    <div>
      <button type="button" className="btn btn-quiet" disabled={pending} onClick={() => start(async () => setR(await checkStripeAction()))}>{pending ? "Checking…" : "Check the Stripe connection"}</button>
      {r && <p role="status" className="mt-3 flex items-start gap-2 text-sm">{r.ok ? <Check size={16} className="mt-0.5 text-moss" aria-hidden /> : <X size={16} className="mt-0.5 text-danger" aria-hidden />}<span><strong>{r.ok ? "Connected" : "Not connected"}</strong> ({r.mode === "test" ? "test mode" : r.mode === "live" ? "LIVE mode" : "unknown mode"}). {r.detail}</span></p>}
    </div>
  );
}
