"use client";
import { useActionState } from "react";
import { requestAccessAction } from "@/app/actions/portal-people";
import { ACCESS_LEVELS } from "@/modules/portal/access";
import { ErrorSummary } from "./ui";

export function RequestAccessForm({ customerId }: { customerId: string }) {
  const [s, act, pending] = useActionState(requestAccessAction, undefined as { error?: string } | undefined);
  return (
    <form action={act} className="space-y-5">
      <ErrorSummary message={s?.error} />
      <input type="hidden" name="customerId" value={customerId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="ra-n">Their name</label><input id="ra-n" name="name" className="field" required autoComplete="off" /></div>
        <div><label className="label" htmlFor="ra-e">Their work email</label><input id="ra-e" name="email" type="email" className="field" required autoComplete="off" /></div>
        <div><label className="label" htmlFor="ra-p">Their role <span className="font-normal text-muted">(optional)</span></label><input id="ra-p" name="position" className="field" placeholder="Manager, Accountant…" /></div>
        <div><label className="label" htmlFor="ra-t">Phone <span className="font-normal text-muted">(optional)</span></label><input id="ra-t" name="phone" className="field" /></div>
      </div>
      <fieldset>
        <legend className="label mb-2">What should they be able to do?</legend>
        <div className="grid gap-2">
          {ACCESS_LEVELS.map((l, i) => (
            <label key={l.id} className="flex cursor-pointer gap-3 rounded-xl border border-line bg-white p-3 has-[:checked]:border-ink has-[:checked]:bg-[#eef7f2]"><input type="radio" name="role" value={l.id} defaultChecked={i === 1} className="mt-1 accent-[#0c6a49]" /><span><span className="block font-semibold">{l.label}</span><span className="block text-sm text-muted">{l.blurb}</span></span></label>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="billing" className="size-4 accent-[#0c6a49]" /> They can also see and pay invoices</label>
      </fieldset>
      <div><label className="label" htmlFor="ra-r">Anything we should know? <span className="font-normal text-muted">(optional)</span></label><textarea id="ra-r" name="reason" rows={3} className="field" placeholder="For example: Sam looks after our bookings." /></div>
      <button className="btn" disabled={pending}>{pending ? "Sending…" : "Ask us to add them"}</button>
      <p className="text-sm text-muted">We check every request before anyone gets access, so it may take a little while. We'll email you when it's done.</p>
    </form>
  );
}
