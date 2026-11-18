"use client";
import { useActionState } from "react";
import { requestAccessAction } from "@/app/actions/portal-people";
import { ACCESS_LEVELS } from "@/modules/portal/access";
import { ErrorSummary } from "./ui";
import { SubmitButton } from "./submit-button";
import { Wizard, type ReviewRow } from "./wizard";

/** A customer asks us to add a colleague: who, what they can do, anything we should know, a check. We approve it before anyone gets access. */
export function RequestAccessForm({ customerId }: { customerId: string }) {
  const [s, act] = useActionState(requestAccessAction, undefined as { error?: string } | undefined);
  const review = (fd: FormData): ReviewRow[] => [
    { label: "Name", value: String(fd.get("name") ?? ""), step: "who" }, { label: "Work email", value: String(fd.get("email") ?? ""), step: "who" },
    { label: "Role", value: String(fd.get("position") ?? ""), step: "who" }, { label: "Phone", value: String(fd.get("phone") ?? ""), step: "who" },
    { label: "What they can do", value: ACCESS_LEVELS.find((l) => l.id === String(fd.get("role") ?? ""))?.label ?? "", step: "access" },
    { label: "Invoices", value: fd.get("billing") === "on" ? "They can see and pay invoices" : "", step: "access" },
    { label: "Notes for us", value: String(fd.get("reason") ?? ""), step: "note" },
  ];
  return (
    <Wizard action={act} review={review} draftKey={`portal-request:${customerId}`} later={{ href: "/people" }} errorMessage={s?.error} error={<ErrorSummary message={s?.error} />}
      intro={<p className="wz-hint">We check every request before anyone gets access, so it may take a little while. We will email you when it is done.</p>}
      actions={<SubmitButton pendingText="Sending…">Ask us to add them</SubmitButton>}
      steps={[
        { id: "who", title: "Who", hint: "Who would you like to add?", node: (
          <>
            <input type="hidden" name="customerId" value={customerId} />
            <div className="grp">
              <label className="grp-row" htmlFor="ra-n"><span>Name</span><input id="ra-n" name="name" required autoComplete="off" placeholder="Their name" /></label>
              <label className="grp-row" htmlFor="ra-e"><span>Work email</span><input id="ra-e" name="email" type="email" inputMode="email" required autoComplete="off" placeholder="name@company.com" /></label>
              <label className="grp-row" htmlFor="ra-p"><span>Role</span><input id="ra-p" name="position" placeholder="Manager, Accountant… (optional)" /></label>
              <label className="grp-row" htmlFor="ra-t"><span>Phone</span><input id="ra-t" name="phone" type="tel" inputMode="tel" placeholder="optional" /></label>
            </div>
          </>) },
        { id: "access", title: "Access", hint: "What should they be able to do?", node: (
          <>
            <div className="opts" role="radiogroup" aria-label="What they can do">
              {ACCESS_LEVELS.map((l, i) => <label key={l.id} className="opt"><input type="radio" name="role" value={l.id} defaultChecked={i === 1} /><span><b>{l.label}</b><small>{l.blurb}</small></span></label>)}
            </div>
            <label className="grp grp-row" htmlFor="ra-b"><span>They can also see and pay invoices</span><span className="sw"><input id="ra-b" type="checkbox" name="billing" /><i aria-hidden /></span></label>
          </>) },
        { id: "note", title: "Notes", hint: "Anything we should know? You can skip this.", node: <textarea id="ra-r" name="reason" rows={4} className="field" placeholder="For example: Sam looks after our bookings." aria-label="Anything we should know" /> },
      ]} />
  );
}
