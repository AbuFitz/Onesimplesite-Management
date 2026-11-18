"use client";
import { AddressFields } from "./address-fields";
import { useActionState, useState } from "react";
import { registerBusinessAction } from "@/app/actions/register";
import { KINDS } from "@/modules/crm/kinds";
import { CATEGORIES, SOURCES } from "@/modules/sales/job-options";
import { ErrorSummary } from "./ui";
import { SubmitButton } from "./submit-button";
import { Wizard, type ReviewRow } from "./wizard";


export function RegisterForm() {
  const [s, act] = useActionState(registerBusinessAction, undefined as { error?: string } | undefined);
  const [kind, setKind] = useState<string>("business");
  const person = kind === "individual";
  const review = (fd: FormData): ReviewRow[] => {
    const g = (k: string) => String(fd.get(k) ?? "");
    return [
      { label: "Kind of customer", value: KINDS.find((k) => k.id === g("kind"))?.label ?? "", step: "kind" },
      { label: person ? "Name" : "Company name", value: g("displayName"), step: "company" }, { label: "Registered name", value: g("legalName"), step: "company" }, { label: "Company number", value: g("companyNumber"), step: "company" },
      { label: "What they do", value: g("businessType"), step: "company" }, { label: "Website", value: g("website"), step: "company" }, { label: "Phone", value: g("phone"), step: "company" },
      { label: "Town", value: g("town"), step: "company" }, { label: "How they found us", value: g("source"), step: "company" },
      { label: "Main contact", value: [g("contactName"), g("contactPosition")].filter(Boolean).join(", "), step: "contact" }, { label: "Contact email", value: g("contactEmail"), step: "contact" }, { label: "Contact phone", value: g("contactPhone"), step: "contact" },
    ];
  };
  const check = async (fd: FormData) => {
    const q = new URLSearchParams({ name: String(fd.get("displayName") ?? ""), number: String(fd.get("companyNumber") ?? ""), email: String(fd.get("contactEmail") ?? "") });
    const r = await fetch(`/api/duplicates?${q}`, { cache: "no-store" }); if (!r.ok) return null;
    const { matches } = (await r.json()) as { matches: { id: string; name: string; ref: string; archived: boolean; why: string }[] };
    if (!matches.length) return null;
    return (
      <div role="alert" className="dup">
        <p><b>This might already exist.</b> Have a look before adding it again.</p>
        <ul>{matches.map((m) => <li key={m.id}><a href={`/customers/${m.id}`} target="_blank" rel="noreferrer"><b>{m.name}</b><em>{m.ref}{m.archived ? " · archived" : ""}</em><span>{m.why}</span></a></li>)}</ul>
      </div>
    );
  };
  return (
    <Wizard action={act} review={review} check={check} draftKey="company-new" later={{ href: "/customers" }} errorMessage={s?.error} onRestore={(v) => { if (typeof v.kind === "string" && v.kind) setKind(v.kind); }} error={<ErrorSummary message={s?.error} />}
      actions={<><SubmitButton pendingText="Saving…">Add company</SubmitButton><button name="next" value="ticket" className="btn btn-quiet">Add company and start an agreement</button></>}
      steps={[
        { id: "kind", title: "Kind", hint: "What kind of customer is this?", node: (<>
        <fieldset>
          <div className="opts">
            {KINDS.map((k) => (
              <label key={k.id} className="opt"><input type="radio" name="kind" value={k.id} checked={kind === k.id} onChange={() => setKind(k.id)} /><span><b>{k.label}</b><small>{k.hint}</small></span></label>
            ))}
          </div>
        </fieldset>
        </>) },
        { id: "company", title: "Company", hint: person ? "Who are they?" : "Tell us about the company. Only the name is needed; the rest can wait.", node: (<>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="rb-n">{person ? "Their name" : "Company name (what they trade as)"}</label><input id="rb-n" name="displayName" className="field" required autoComplete="off" /></div>
          {kind === "business" && <div><label className="label" htmlFor="rb-l">Registered company name <span className="font-normal text-muted">(if different)</span></label><input id="rb-l" name="legalName" className="field" autoComplete="off" /></div>}
          {kind === "business" && <div><label className="label" htmlFor="rb-c">Company number</label><input id="rb-c" name="companyNumber" className="field" inputMode="numeric" autoComplete="off" /></div>}
          {kind !== "business" && <div><label className="label" htmlFor="rb-l2">{person ? "Full name for agreements" : "Full legal name for agreements"}</label><input id="rb-l2" name="legalName" className="field" autoComplete="off" /></div>}
          <div><label className="label" htmlFor="rb-t">What do they do?</label><select id="rb-t" name="businessType" className="field" defaultValue=""><option value="">Not sure</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="label" htmlFor="rb-w">Their current website <span className="font-normal text-muted">(if they have one)</span></label><input id="rb-w" name="website" className="field" inputMode="url" placeholder="www.example.co.uk" /></div>
          <div><label className="label" htmlFor="rb-p">Company phone <span className="font-normal text-muted">(optional)</span></label><input id="rb-p" name="phone" className="field" type="tel" /></div>
          <AddressFields />
          <div><label className="label" htmlFor="rb-s">How did they find us?</label><select id="rb-s" name="source" className="field" defaultValue=""><option value="">Not sure</option>{SOURCES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        </div>
        </>) },
        { id: "contact", title: "Contact", hint: "Who are we talking to? You can add more people, with their own portal access, once the company exists.", node: (<>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="rc-n">Name</label><input id="rc-n" name="contactName" className="field" required autoComplete="off" /></div>
          <div><label className="label" htmlFor="rc-e">Email</label><input id="rc-e" name="contactEmail" type="email" className="field" required autoComplete="off" /></div>
          <div><label className="label" htmlFor="rc-r">Their role</label><select id="rc-r" name="contactPosition" className="field" defaultValue="Owner">{["Owner", "Director", "Manager", "Accountant", "Assistant", "Other"].map((r) => <option key={r}>{r}</option>)}</select></div>
          <div><label className="label" htmlFor="rc-p">Phone <span className="font-normal text-muted">(optional)</span></label><input id="rc-p" name="contactPhone" type="tel" className="field" /></div>
        </div>
        </>) },
      ]} />
  );
}
