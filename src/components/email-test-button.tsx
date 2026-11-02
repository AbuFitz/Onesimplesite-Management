"use client";
import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { sendTestEmailsAction } from "@/app/actions/email-test";
import type { TestResult } from "@/modules/settings/email-test";

/** Sends the real email(s) to hello@ so the team can see them arrive. */
export function EmailTestButton({ only, label }: { only?: string; label: string }) {
  const [pending, start] = useTransition();
  const [out, setOut] = useState<{ to: string; results: TestResult[] } | null>(null);
  return (
    <div>
      <button type="button" className={only ? "btn btn-quiet" : "btn"} disabled={pending} onClick={() => start(async () => setOut(await sendTestEmailsAction(only)))}>{pending ? "Sending…" : label}</button>
      {out && (
        <div role="status" className="mt-3 rounded-xl border border-line bg-white p-4 text-sm">
          <p className="mb-2 font-semibold">Sent to {out.to}. Check that inbox (and spam) for the emails below.</p>
          <ul className="space-y-1">{out.results.map((r) => <li key={r.id} className="flex items-start gap-2">{r.ok ? <Check size={16} className="mt-0.5 shrink-0 text-moss" aria-hidden /> : <X size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden />}<span><strong>{r.label}</strong> <span className="text-muted">· {r.detail}</span></span></li>)}</ul>
        </div>
      )}
    </div>
  );
}
