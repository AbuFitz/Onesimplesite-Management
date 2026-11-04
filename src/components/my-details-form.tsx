"use client";
import { useActionState } from "react";
import { updateMyDetailsAction } from "@/app/actions/portal-people";

const POSITIONS = ["Owner", "Director", "Manager", "Office manager", "Accountant", "Marketing", "Assistant", "Other"];
export function MyDetailsForm({ name, email, phone, position }: { name: string; email: string; phone: string; position: string }) {
  const [s, act, pending] = useActionState(updateMyDetailsAction, undefined as { error?: string; done?: boolean } | undefined);
  return (
    <form action={act} className="grid gap-3 sm:grid-cols-2">
      <div><label className="label" htmlFor="md-n">Your name</label><input id="md-n" name="name" className="field" defaultValue={name} required autoComplete="name" /></div>
      <div><label className="label" htmlFor="md-e">Email <span className="font-normal text-muted">(your login)</span></label><input id="md-e" className="field bg-bone" value={email} readOnly aria-describedby="md-eh" /><p id="md-eh" className="hint mt-1">To change it, tell us and we'll switch it over safely.</p></div>
      <div><label className="label" htmlFor="md-t">Phone <span className="font-normal text-muted">(optional)</span></label><input id="md-t" name="phone" type="tel" inputMode="tel" className="field" defaultValue={phone} autoComplete="tel" /></div>
      <div><label className="label" htmlFor="md-p">Your role <span className="font-normal text-muted">(optional)</span></label><input id="md-p" name="position" list="md-pos" className="field" defaultValue={position} autoComplete="organization-title" /><datalist id="md-pos">{POSITIONS.map((p) => <option key={p} value={p} />)}</datalist></div>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-3"><button className="btn" disabled={pending}>{pending ? "Saving…" : "Save my details"}</button>
        {s?.done && <span role="status" className="text-sm font-semibold text-moss">Saved.</span>}{s?.error && <span role="alert" className="text-sm font-semibold text-[#7a2e12]">{s.error}</span>}</div>
    </form>
  );
}
