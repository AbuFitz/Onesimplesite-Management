import { Avatar } from "@/components/ui";
import { AddPersonForm } from "@/components/add-person-form";
import { addPersonAction, updatePersonAction, invitePersonAction, setAccessAction, resetPasswordAction, revokeAccessAction, removePersonAction, approveRequestAction, declineRequestAction, makeMainContactAction, resetTwoStepAction } from "@/app/actions/people";
import { ACCESS_LEVELS, levelLabel } from "@/modules/portal/access";
import type { Person } from "@/modules/people/service";
import { timeAgo } from "./ui";
import { SubmitButton } from "./submit-button";
import { SheetButton } from "./sheet-button";

type Req = { id: string; name: string; email: string; position: string | null; role: string; billing: boolean; reason: string | null; requestedByName: string; createdAt: Date };

const STATE: Record<Person["access"], { label: string; cls: string }> = {
  none: { label: "No portal access", cls: "bg-bone text-muted" }, invited: { label: "Invited", cls: "bg-[#fbf3d5] text-[#5c4700]" },
  active: { label: "Has access", cls: "bg-[#e9f6ef] text-[#0a5a3d]" }, revoked: { label: "Access removed", cls: "bg-[#fde6dc] text-[#7a2e12]" },
};

const POSITIONS = ["Owner", "Director", "Manager", "Office manager", "Accountant", "Marketing", "Assistant", "Other"];
function Level({ role = "member", billing = false, id }: { role?: string; billing?: boolean; id: string }) {
  return (
    <fieldset className="space-y-2">
      <legend className="label">What can they do in the portal?</legend>
      <div className="opts sm:grid-cols-3 sm:!grid-flow-col">
        {ACCESS_LEVELS.map((l) => (
          <label key={l.id} className="opt">
            <input type="radio" name="role" value={l.id} defaultChecked={role === l.id} /><span><b>{l.label}</b><small>{l.blurb}</small></span>
          </label>
        ))}
      </div>
      <label className="grp grp-row" htmlFor={`${id}-bill`}><span>Can see and pay invoices<small className="ml-2 text-muted">owners always can</small></span><span className="sw"><input id={`${id}-bill`} type="checkbox" name="billing" defaultChecked={billing} /><i aria-hidden /></span></label>
    </fieldset>
  );
}
const Hidden = ({ customerId, contactId }: { customerId: string; contactId?: string }) => <><input type="hidden" name="customerId" value={customerId} />{contactId && <input type="hidden" name="contactId" value={contactId} />}</>;

/** Everyone at the company, what each can do in the portal, and every control the team needs. */
export function PeoplePanel({ customerId, people, requests, canEdit }: { customerId: string; people: Person[]; requests: Req[]; canEdit: boolean }) {
  return (
    <div className="space-y-8">
      {requests.length > 0 && (
        <section aria-label="Access requests" className="rounded-[28px] border border-white/90 bg-white/70 p-4 shadow-[0_8px_18px_-14px_rgba(18,28,12,.5)]">
          <h2 className="text-lg">Asked to add to the portal</h2>
          <ul className="mt-3 space-y-4">
            {requests.map((r) => (
              <li key={r.id} className="rounded-xl bg-white p-4 text-sm">
                <p><strong>{r.name}</strong> ({r.email}){r.position ? `, ${r.position}` : ""}</p>
                <p className="text-muted">Asked by {r.requestedByName} {timeAgo(r.createdAt)}. {r.reason ? `Why: ${r.reason}` : ""}</p>
                {canEdit && (
                  <div className="mt-3 flex flex-wrap items-start gap-6">
                    <form action={approveRequestAction} className="space-y-2"><Hidden customerId={customerId} /><input type="hidden" name="requestId" value={r.id} /><Level id={`q-${r.id}`} role={r.role} billing={r.billing} /><SubmitButton>Approve and invite</SubmitButton></form>
                    <form action={declineRequestAction} className="space-y-2"><Hidden customerId={customerId} /><input type="hidden" name="requestId" value={r.id} /><label className="label" htmlFor={`d-${r.id}`}>Reason (shown to them)</label><input id={`d-${r.id}`} name="reason" className="field !min-h-11 sm:!min-h-9" placeholder="Optional" /><button className="btn btn-quiet">Decline</button></form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="People">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg">People <span className="font-normal text-muted">· {people.length}</span></h2>
          {canEdit && <SheetButton label="Add a person" title="Add a person"><AddPersonForm customerId={customerId} action={addPersonAction} positions={POSITIONS} /></SheetButton>}
        </div>
        {people.length === 0 ? <p className="text-sm text-muted">Nobody added yet.</p> : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
            {people.map((p) => { const st = STATE[p.access]; return (
              <li key={p.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold"><Avatar name={p.name} size={28} staffId={p.userId} base="/api/avatar/u" />{p.name}{p.isPrimary && <span className="ml-2 text-xs font-normal text-muted">main contact</span>}</p>
                    <p className="text-sm text-muted">{[p.position, p.email, p.phone].filter(Boolean).join(" · ") || "No details"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={`rounded-md px-2 py-0.5 font-semibold ${st.cls}`}>{st.label}</span>
                    {canEdit && p.access === "none" && p.email && <form action={invitePersonAction}><Hidden customerId={customerId} contactId={p.id} /><input type="hidden" name="role" value="member" /><SubmitButton className="btn !min-h-9 text-[13px]" pendingText="Inviting…">Invite as team member</SubmitButton></form>}
                    {p.role && p.access !== "none" && p.access !== "revoked" && <span className="rounded-md bg-bone px-2 py-0.5">{levelLabel(p.role)}{p.billing && p.role !== "admin" ? " + billing" : ""}</span>}
                    {p.access === "active" && <span className={`rounded-md px-2 py-0.5 font-semibold ${p.twoStep?.authenticator ? "bg-[#e9f6ef] text-[#0a5a3d]" : "bg-bone text-muted"}`}>{p.twoStep?.authenticator ? "Two-step on" : "Two-step not set up"}{p.twoStep?.passkeys ? ` · ${p.twoStep.passkeys} passkey${p.twoStep.passkeys > 1 ? "s" : ""}` : ""}</span>}
                    {p.access === "active" && <span className="text-muted">{p.lastSeen ? `Last seen ${timeAgo(p.lastSeen)}` : "Not signed in yet"}</span>}
                  </div>
                </div>
                {canEdit && (
                  <div className="mt-2"><SheetButton label="Manage" title={p.name} className="evt-b" icon={false}>
                    <div className="space-y-5 text-sm">
                      {(p.access === "none" || p.access === "invited") && p.email && (
                        <form action={invitePersonAction} className="space-y-2"><Hidden customerId={customerId} contactId={p.id} /><Level id={`i-${p.id}`} role={p.role ?? "member"} billing={p.billing} /><SubmitButton>{p.access === "invited" ? "Send the invitation again" : "Invite to the client portal"}</SubmitButton></form>
                      )}
                      {(p.access === "none") && !p.email && <p className="text-muted">Add an email address below to invite them.</p>}
                      {p.access === "active" && (
                        <>
                          <form action={setAccessAction} className="space-y-2"><Hidden customerId={customerId} contactId={p.id} /><Level id={`a-${p.id}`} role={p.role ?? "member"} billing={p.billing} /><button className="btn btn-quiet">Save access</button></form>
                          <div className="flex flex-wrap gap-2">
                            <form action={resetPasswordAction}><Hidden customerId={customerId} contactId={p.id} /><SubmitButton className="btn btn-quiet">Send password reset email</SubmitButton></form>
                            <form action={revokeAccessAction}><Hidden customerId={customerId} contactId={p.id} /><button className="btn btn-quiet">Remove portal access and sign them out</button></form>
                            <details className="rounded-lg border border-line bg-white px-3 py-2"><summary className="min-h-9 cursor-pointer py-1.5 font-semibold">Reset two-step sign-in</summary>
                              <form action={resetTwoStepAction} className="mt-2 space-y-2"><Hidden customerId={customerId} contactId={p.id} /><p className="text-muted">For when they've lost their phone. This removes their authenticator app, passkeys and trusted devices, signs them out everywhere and emails them. Check it really is {p.name.split(" ")[0]} first (call the number we have on file).</p><button className="btn !border-[#b3261e] !bg-[#b3261e] !text-white">Reset for {p.name.split(" ")[0]}</button></form></details>
                          </div>
                        </>
                      )}
                      {p.access === "invited" && <form action={revokeAccessAction}><Hidden customerId={customerId} contactId={p.id} /><button className="btn btn-quiet">Cancel the invitation</button></form>}
                      {p.access === "revoked" && <form action={invitePersonAction} className="space-y-2"><Hidden customerId={customerId} contactId={p.id} /><Level id={`g-${p.id}`} role={p.role ?? "member"} billing={p.billing} /><SubmitButton>Give access again</SubmitButton></form>}
                      {!p.isPrimary && <form action={makeMainContactAction}><Hidden customerId={customerId} contactId={p.id} /><button className="btn btn-quiet">Make main contact</button></form>}
                      <form action={updatePersonAction} className="grid gap-3 sm:grid-cols-2"><Hidden customerId={customerId} contactId={p.id} />
                        <div><label className="label" htmlFor={`n-${p.id}`}>Name</label><input id={`n-${p.id}`} name="name" className="field !min-h-11 sm:!min-h-9" defaultValue={p.name} required /></div>
                        <div><label className="label" htmlFor={`e-${p.id}`}>Email</label><input id={`e-${p.id}`} name="email" type="email" className="field !min-h-11 sm:!min-h-9" defaultValue={p.email ?? ""} required /></div>
                        <div><label className="label" htmlFor={`p-${p.id}`}>Position</label><input id={`p-${p.id}`} name="position" list="positions" className="field !min-h-11 sm:!min-h-9" defaultValue={p.position ?? ""} placeholder="Owner, Manager, Accountant…" /></div>
                        <div><label className="label" htmlFor={`t-${p.id}`}>Phone</label><input id={`t-${p.id}`} name="phone" type="tel" inputMode="tel" autoComplete="off" className="field !min-h-11 sm:!min-h-9" defaultValue={p.phone ?? ""} /></div>
                        <div className="sm:col-span-2"><button className="btn btn-quiet">Save details</button></div>
                      </form>
                      <details className="border-t border-line pt-3"><summary className="cursor-pointer text-[#7a2e12]">They've left the company</summary>
                        <form action={removePersonAction} className="mt-2 space-y-2"><Hidden customerId={customerId} contactId={p.id} /><p>This removes {p.name} from the list and ends any portal access straight away. Tickets they raised stay, without their name.</p><button className="btn !border-[#b3261e] !bg-[#b3261e] !text-white">Remove {p.name.split(" ")[0]}</button></form></details>
                    </div>
                  </SheetButton></div>
                )}
              </li>); })}
          </ul>
        )}
      </section>

      <datalist id="positions">{POSITIONS.map((p) => <option key={p} value={p} />)}</datalist>
    </div>
  );
}
