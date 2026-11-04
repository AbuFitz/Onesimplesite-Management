"use client";
import { useActionState, useState } from "react";
import { registerBusinessAction } from "@/app/actions/register";
import { KINDS } from "@/modules/crm/kinds";
import { CATEGORIES, SOURCES } from "@/modules/sales/job-options";
import { ErrorSummary } from "./ui";
import { SubmitButton } from "./submit-button";

/** Two short sections: the company, then its first person. Everything else can be added later. */
export function RegisterForm() {
  const [s, act] = useActionState(registerBusinessAction, undefined as { error?: string } | undefined);
  const [kind, setKind] = useState<string>("business");
  const person = kind === "individual";
  return (
    <form action={act} className="max-w-3xl space-y-10">
      <ErrorSummary message={s?.error} />
      <section aria-labelledby="r1" className="card-section space-y-5">
        <h2 id="r1" className="text-xl">1. The company</h2>
        <fieldset>
          <legend className="label mb-2">What kind of customer is this?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {KINDS.map((k) => (
              <label key={k.id} className="flex cursor-pointer flex-col rounded-xl border border-line bg-white p-3 has-[:checked]:border-ink has-[:checked]:bg-[#eef7f2]"><input type="radio" name="kind" value={k.id} checked={kind === k.id} onChange={() => setKind(k.id)} className="sr-only" /><span className="font-semibold">{k.label}</span><span className="text-sm text-muted">{k.hint}</span></label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="rb-n">{person ? "Their name" : "Company name (what they trade as)"}</label><input id="rb-n" name="displayName" className="field" required autoComplete="off" /></div>
          {kind === "business" && <div><label className="label" htmlFor="rb-l">Registered company name <span className="font-normal text-muted">(if different)</span></label><input id="rb-l" name="legalName" className="field" autoComplete="off" /></div>}
          {kind === "business" && <div><label className="label" htmlFor="rb-c">Company number</label><input id="rb-c" name="companyNumber" className="field" inputMode="numeric" autoComplete="off" /></div>}
          {kind !== "business" && <div><label className="label" htmlFor="rb-l2">{person ? "Full name for agreements" : "Full legal name for agreements"}</label><input id="rb-l2" name="legalName" className="field" autoComplete="off" /></div>}
          <div><label className="label" htmlFor="rb-t">What do they do?</label><select id="rb-t" name="businessType" className="field" defaultValue=""><option value="">Not sure</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="label" htmlFor="rb-to">Town or city</label><input id="rb-to" name="town" className="field" autoComplete="off" placeholder="e.g. Bristol" /></div>
          <div><label className="label" htmlFor="rb-w">Their current website <span className="font-normal text-muted">(if they have one)</span></label><input id="rb-w" name="website" className="field" inputMode="url" placeholder="www.example.co.uk" /></div>
          <div><label className="label" htmlFor="rb-p">Company phone <span className="font-normal text-muted">(optional)</span></label><input id="rb-p" name="phone" className="field" type="tel" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="rb-a">Address <span className="font-normal text-muted">(needed before an agreement is sent, can be added later)</span></label><textarea id="rb-a" name="billingAddress" className="field" rows={2} autoComplete="street-address" /></div>
          <div><label className="label" htmlFor="rb-s">How did they find us?</label><select id="rb-s" name="source" className="field" defaultValue=""><option value="">Not sure</option>{SOURCES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        </div>
      </section>
      <section aria-labelledby="r2" className="card-section space-y-5">
        <div><h2 id="r2" className="text-xl">2. Who are we talking to?</h2><p className="text-sm text-muted">The main contact. You can add more people, with their own portal access, once the company exists.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="rc-n">Name</label><input id="rc-n" name="contactName" className="field" required autoComplete="off" /></div>
          <div><label className="label" htmlFor="rc-e">Email</label><input id="rc-e" name="contactEmail" type="email" className="field" required autoComplete="off" /></div>
          <div><label className="label" htmlFor="rc-r">Their role</label><select id="rc-r" name="contactPosition" className="field" defaultValue="Owner">{["Owner", "Director", "Manager", "Accountant", "Assistant", "Other"].map((r) => <option key={r}>{r}</option>)}</select></div>
          <div><label className="label" htmlFor="rc-p">Phone <span className="font-normal text-muted">(optional)</span></label><input id="rc-p" name="contactPhone" type="tel" className="field" /></div>
        </div>
      </section>
      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingText="Saving…">Add company</SubmitButton>
        <button name="next" value="ticket" className="btn btn-quiet">Add company and start a ticket</button>
      </div>
    </form>
  );
}
