"use client";
import { SubmitButton } from "./submit-button";
import { Wizard, type ReviewRow } from "./wizard";
import { ACCESS_LEVELS } from "@/modules/portal/access";

/** Add a person to a company: who, how to reach them, whether they get a portal login (and what it lets them do), a check. */
export function AddPersonForm({ customerId, action, positions }: { customerId: string; action: (fd: FormData) => void | Promise<void>; positions: string[] }) {
  const review = (fd: FormData): ReviewRow[] => [
    { label: "Name", value: String(fd.get("name") ?? ""), step: "who" }, { label: "Email", value: String(fd.get("email") ?? ""), step: "who" },
    { label: "Position", value: String(fd.get("position") ?? ""), step: "details" }, { label: "Phone", value: String(fd.get("phone") ?? ""), step: "details" },
    { label: "Portal login", value: fd.get("invite") === "on" ? `Invited now as ${ACCESS_LEVELS.find((l) => l.id === String(fd.get("role") ?? ""))?.label ?? "a member"}${fd.get("billing") === "on" ? ", with invoices" : ""}` : "Not yet. You can invite them later.", step: "access" },
  ];
  return (
    <>
      <Wizard action={action as (fd: FormData) => void} review={review} draftKey={`person:${customerId}`}
        actions={<SubmitButton pendingText="Adding…">Add person</SubmitButton>}
        steps={[
          { id: "who", title: "Who", hint: "Who are you adding?", node: (
            <>
              <input type="hidden" name="customerId" value={customerId} />
              <div className="grp">
                <label className="grp-row" htmlFor="ap-n"><span>Name</span><input id="ap-n" name="name" required autoComplete="off" placeholder="Full name" /></label>
                <label className="grp-row" htmlFor="ap-e"><span>Email</span><input id="ap-e" name="email" type="email" inputMode="email" required autoComplete="off" placeholder="name@company.com" /></label>
              </div>
            </>) },
          { id: "details", title: "Details", hint: "A little more, if you have it. Both can wait.", node: (
            <div className="grp">
              <label className="grp-row" htmlFor="ap-p"><span>Position</span><input id="ap-p" name="position" list="positions-new" placeholder="Choose or type" autoComplete="off" /></label>
              <label className="grp-row" htmlFor="ap-t"><span>Phone</span><input id="ap-t" name="phone" type="tel" inputMode="tel" autoComplete="off" placeholder="optional" /></label>
            </div>) },
          { id: "access", title: "Portal", hint: "Should they get a customer portal login now? You can also invite them later.", node: (
            <>
              <label className="grp grp-row" htmlFor="ap-i"><span>Send a portal invitation now</span><span className="sw"><input id="ap-i" type="checkbox" name="invite" /><i aria-hidden /></span></label>
              <div className="opts" role="radiogroup" aria-label="What they can do in the portal">
                {ACCESS_LEVELS.map((l, i) => <label key={l.id} className="opt"><input type="radio" name="role" value={l.id} defaultChecked={i === 1} /><span><b>{l.label}</b><small>{l.blurb}</small></span></label>)}
              </div>
              <label className="grp grp-row" htmlFor="ap-b"><span>Can see and pay invoices</span><span className="sw"><input id="ap-b" type="checkbox" name="billing" /><i aria-hidden /></span></label>
            </>) },
        ]} />
      <datalist id="positions-new">{positions.map((p) => <option key={p} value={p} />)}</datalist>
    </>
  );
}
