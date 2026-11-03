import { addPersonAction, updatePersonAction, invitePersonAction, setAccessAction, resetPasswordAction, revokeAccessAction, removePersonAction, approveRequestAction, declineRequestAction } from "@/app/actions/people";
import { ACCESS_LEVELS, levelLabel } from "@/modules/portal/access";
import type { Person } from "@/modules/people/service";
import { timeAgo } from "./ui";
import { SubmitButton } from "./submit-button";

type Req = { id: string; name: string; email: string; position: string | null; role: string; billing: boolean; reason: string | null; requestedByName: string; createdAt: Date };

const STATE: Record<Person["access"], { label: string; cls: string }> = {
  none: { label: "No portal access", cls: "bg-bone text-muted" }, invited: { label: "Invited", cls: "bg-[#fbf3d5] text-[#5c4700]" },
  active: { label: "Has access", cls: "bg-[#e9f6ef] text-[#0a5a3d]" }, revoked: { label: "Access removed", cls: "bg-[#fde6dc] text-[#7a2e12]" },
};

function Level({ role = "member", billing = false, id }: { role?: string; billing?: boolean; id: string }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div><label className="label" htmlFor={`r-${id}`}>Access level</label>
        <select id={`r-${id}`} name="role" className="field !min-h-9" defaultValue={role}>{ACCESS_LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}: {l.blurb}</option>)}</select></div>
      <label className="flex min-h-9 items-center gap-2 text-sm"><input type="checkbox" name="billing" defaultChecked={billing} className="size-4 accent-[#0c6a49]" /> Can see and pay invoices</label>
    </div>
  );
}
const Hidden = ({ customerId, contactId }: { customerId: string; contactId?: string }) => <><input type="hidden" name="customerId" value={customerId} />{contactId && <input type="hidden" name="contactId" value={contactId} />}</>;

/** Everyone at the business, what each can do in the portal, and every control the team needs. */
export function PeoplePanel({ customerId, people, requests, canEdit }: { customerId: string; people: Person[]; requests: Req[]; canEdit: boolean }) {
  return (
    <div className="space-y-8">
      {requests.length > 0 && (
        <section aria-label="Access requests" className="rounded-2xl border border-[#e5d58a] bg-[#fbf3d5]/60 p-4">
          <h2 className="text-lg">Asked to add to the portal</h2>
          <ul className="mt-3 space-y-4">
            {requests.map((r) => (
              <li key={r.id} className="rounded-xl bg-white p-4 text-sm">
                <p><strong>{r.name}</strong> ({r.email}){r.position ? `, ${r.position}` : ""}</p>
                <p className="text-muted">Asked by {r.requestedByName} {timeAgo(r.createdAt)}. {r.reason ? `Why: ${r.reason}` : ""}</p>
                {canEdit && (
                  <div className="mt-3 flex flex-wrap items-start gap-6">
                    <form action={approveRequestAction} className="space-y-2"><Hidden customerId={customerId} /><input type="hidden" name="requestId" value={r.id} /><Level id={`q-${r.id}`} role={r.role} billing={r.billing} /><SubmitButton>Approve and invite</SubmitButton></form>
                    <form action={declineRequestAction} className="space-y-2"><Hidden customerId={customerId} /><input type="hidden" name="requestId" value={r.id} /><label className="label" htmlFor={`d-${r.id}`}>Reason (shown to them)</label><input id={`d-${r.id}`} name="reason" className="field !min-h-9" placeholder="Optional" /><button className="btn btn-quiet">Decline</button></form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="People">
        <h2 className="mb-1 text-lg">People</h2>
        <p className="mb-4 text-sm text-muted">Everyone at this business. Add them here, then invite the ones who need the client portal and choose what they can do.</p>
        {people.length === 0 ? <p className="text-sm text-muted">Nobody added yet.</p> : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
            {people.map((p) => { const st = STATE[p.access]; return (
              <li key={p.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{p.name}{p.isPrimary && <span className="ml-2 text-xs font-normal text-muted">main contact</span>}</p>
                    <p className="text-sm text-muted">{[p.position, p.email, p.phone].filter(Boolean).join(" · ") || "No details"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={`rounded-md px-2 py-0.5 font-semibold ${st.cls}`}>{st.label}</span>
                    {p.role && p.access !== "none" && p.access !== "revoked" && <span className="rounded-md bg-bone px-2 py-0.5">{levelLabel(p.role)}{p.billing && p.role !== "admin" ? " + billing" : ""}</span>}
                    {p.access === "active" && <span className="text-muted">{p.lastSeen ? `Last seen ${timeAgo(p.lastSeen)}` : "Not signed in yet"}</span>}
                  </div>
                </div>
                {canEdit && (
                  <details className="mt-3">
                    <summary className="min-h-9 cursor-pointer text-sm font-semibold">Manage</summary>
                    <div className="mt-3 space-y-5 rounded-xl bg-bone/60 p-4 text-sm">
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
                          </div>
                        </>
                      )}
                      {p.access === "invited" && <form action={revokeAccessAction}><Hidden customerId={customerId} contactId={p.id} /><button className="btn btn-quiet">Cancel the invitation</button></form>}
                      {p.access === "revoked" && <form action={invitePersonAction} className="space-y-2"><Hidden customerId={customerId} contactId={p.id} /><Level id={`g-${p.id}`} role={p.role ?? "member"} billing={p.billing} /><SubmitButton>Give access again</SubmitButton></form>}
                      <form action={updatePersonAction} className="grid gap-3 sm:grid-cols-2"><Hidden customerId={customerId} contactId={p.id} />
                        <div><label className="label" htmlFor={`n-${p.id}`}>Name</label><input id={`n-${p.id}`} name="name" className="field !min-h-9" defaultValue={p.name} required /></div>
                        <div><label className="label" htmlFor={`e-${p.id}`}>Email</label><input id={`e-${p.id}`} name="email" type="email" className="field !min-h-9" defaultValue={p.email ?? ""} required /></div>
                        <div><label className="label" htmlFor={`p-${p.id}`}>Position</label><input id={`p-${p.id}`} name="position" className="field !min-h-9" defaultValue={p.position ?? ""} placeholder="Owner, Manager, Accountant…" /></div>
                        <div><label className="label" htmlFor={`t-${p.id}`}>Phone</label><input id={`t-${p.id}`} name="phone" className="field !min-h-9" defaultValue={p.phone ?? ""} /></div>
                        <div className="sm:col-span-2"><button className="btn btn-quiet">Save details</button></div>
                      </form>
                      <details className="border-t border-line pt-3"><summary className="cursor-pointer text-[#7a2e12]">They've left the business</summary>
                        <form action={removePersonAction} className="mt-2 space-y-2"><Hidden customerId={customerId} contactId={p.id} /><p>This removes {p.name} from the list and ends any portal access straight away. Tickets they raised stay, without their name.</p><button className="btn !border-[#b3261e] !bg-[#b3261e] !text-white">Remove {p.name.split(" ")[0]}</button></form></details>
                    </div>
                  </details>
                )}
              </li>); })}
          </ul>
        )}
      </section>

      {canEdit && (
        <section aria-label="Add a person" className="max-w-2xl rounded-2xl border border-line bg-white p-4">
          <h2 className="text-lg">Add a person</h2>
          <form action={addPersonAction} className="mt-3 grid gap-3 sm:grid-cols-2"><input type="hidden" name="customerId" value={customerId} />
            <div><label className="label" htmlFor="ap-n">Name</label><input id="ap-n" name="name" className="field" required autoComplete="off" /></div>
            <div><label className="label" htmlFor="ap-e">Email</label><input id="ap-e" name="email" type="email" className="field" required autoComplete="off" /></div>
            <div><label className="label" htmlFor="ap-p">Position <span className="font-normal text-muted">(optional)</span></label><input id="ap-p" name="position" className="field" placeholder="Owner, Manager, Accountant…" /></div>
            <div><label className="label" htmlFor="ap-t">Phone <span className="font-normal text-muted">(optional)</span></label><input id="ap-t" name="phone" className="field" /></div>
            <div className="sm:col-span-2"><button className="btn">Add person</button></div>
          </form>
        </section>
      )}
    </div>
  );
}
