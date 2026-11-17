"use client";
import { useActionState, useState } from "react";
import { Globe, Wrench, LifeBuoy } from "lucide-react";
import { createTicketStaffAction } from "@/app/actions/tickets";
import { TICKET_KINDS } from "@/modules/support/options";
import { WORK_TYPES } from "@/modules/sales/job-options";
import { ErrorSummary } from "./ui";
import { SubmitButton } from "./submit-button";

const TYPES = [
  { id: "change_request", label: "Change request", hint: "Work outside their plan. We price it, they approve, they pay.", Icon: Wrench, tone: "bg-[#fbf3d5]" },
  { id: "support", label: "Support", hint: "Something is broken, or a question. Covered by their plan.", Icon: LifeBuoy, tone: "bg-[#e3effa]" },
] as const;

type P = { id: string; name: string; position: string | null };
export function TicketCreateForm({ customer, people, team, me, initialType }: { customer: { id: string; name: string }; people: P[]; team: { id: string; name: string }[]; me: string; initialType?: string }) {
  const [s, act] = useActionState(createTicketStaffAction, undefined as { error?: string } | undefined);
  const [type, setType] = useState<string>(TYPES.some((t) => t.id === initialType) ? initialType! : "");
  const [cost, setCost] = useState("later");
  const [who, setWho] = useState(people[0]?.id ?? "new");
  return (
    <form action={act} className="max-w-2xl space-y-6">
      <ErrorSummary message={s?.error} />
      <input type="hidden" name="customerId" value={customer.id} /><input type="hidden" name="type" value={type} />

      <fieldset>
        <legend className="tc-leg !text-[17px] !text-ink">What kind of ticket is it?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {TYPES.map(({ id, label, hint, Icon }) => (
            <button type="button" key={id} aria-pressed={type === id} onClick={() => setType(id)} className={`tc-type ${type === id ? "on" : ""}`}>
              <span className="tc-ico"><Icon size={20} aria-hidden /></span>
              <b>{label}</b><small>{hint}</small>
            </button>
          ))}
        </div>
      </fieldset>

      {type && (
        <>
          <fieldset className="evf-set" aria-label="Who">
            <legend className="tc-leg">Who got in touch?</legend>
            <div className="rchips" role="radiogroup">
              {people.map((p) => <label key={p.id} className="rchip"><input type="radio" name="contactId" value={p.id} checked={who === p.id} onChange={() => setWho(p.id)} /><span>{p.name}{p.position ? <em className="rchip-rec">{p.position}</em> : null}</span></label>)}
              <label className="rchip"><input type="radio" name="contactId" value="new" checked={who === "new"} onChange={() => setWho("new")} /><span>Someone new</span></label>
            </div>
            {who === "new" && (
              <div className="grp tc-new">
                <label className="grp-row" htmlFor="tc-nn"><span>Name</span><input id="tc-nn" name="newName" required autoComplete="off" placeholder="Their name" /></label>
                <label className="grp-row" htmlFor="tc-ne"><span>Email</span><input id="tc-ne" name="newEmail" type="email" inputMode="email" required autoComplete="off" placeholder="name@company.com" /></label>
                <label className="grp-row" htmlFor="tc-np"><span>Role</span><input id="tc-np" name="newPosition" placeholder="Manager…" /></label>
              </div>
            )}
          </fieldset>

          {type === "onboarding" && <div><label className="tc-leg" htmlFor="tc-w">What do they want?</label><select id="tc-w" name="work" className="field" defaultValue="simple">{WORK_TYPES.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}</select></div>}
          {type === "support" && (
            <fieldset className="evf-set"><legend className="tc-leg">What is it?</legend>
              <div className="rchips" role="radiogroup">{TICKET_KINDS.map((k) => <label key={k.id} className="rchip"><input type="radio" name="kind" value={k.id} defaultChecked={k.id === "issue"} /><span>{k.label}</span></label>)}</div>
            </fieldset>
          )}

          <div className="tc-write">
            <label className="sr-only" htmlFor="tc-t">Short title</label>
            <input id="tc-t" name="title" className="evf-title" placeholder={type === "onboarding" ? "Short title (optional)" : "Short title"} maxLength={140} required={type !== "onboarding"} autoComplete="off" />
            <label className="tc-leg" htmlFor="tc-d">{type === "onboarding" ? "What did they say they want?" : "What happened, or what do they want changed?"}</label>
            <textarea id="tc-d" name="details" rows={5} className="field" required={type !== "onboarding"} />
          </div>

          {type === "change_request" && (
            <fieldset className="evf-set"><legend className="tc-leg">Is there a cost?</legend>
              <div className="opts" role="radiogroup">
                {[["later", "Decide the price later", "It stays open until you set one."], ["included", "No charge", "Covered by their plan."], ["charge", "Charge for it", "They approve the price in the portal, then pay by card."]].map(([v, l, d]) => (
                  <label key={v} className="opt"><input type="radio" name="cost" value={v} checked={cost === v} onChange={() => setCost(v)} /><span><b>{l}</b><small>{d}</small></span></label>
                ))}
              </div>
              {cost === "charge" && (
                <div className="grp tc-new">
                  <label className="grp-row" htmlFor="tc-pr"><span>Price (£)</span><input id="tc-pr" name="price" type="number" min="1" step="0.01" inputMode="decimal" required placeholder="0.00" /></label>
                  <label className="grp-row" htmlFor="tc-cn"><span>Note</span><input id="tc-cn" name="costNote" placeholder="Includes setup and testing (optional)" /></label>
                </div>
              )}
            </fieldset>
          )}

          <fieldset className="evf-set"><legend className="tc-leg">Priority</legend>
            <div className="rchips" role="radiogroup">{[["low", "Low"], ["normal", "Normal"], ["high", "High"], ["urgent", "Urgent"]].map(([v, l]) => <label key={v} className="rchip"><input type="radio" name="priority" value={v} defaultChecked={v === "normal"} /><span>{l}</span></label>)}</div>
          </fieldset>
          <div className="grp"><label className="grp-row" htmlFor="tc-as"><span>Owner</span><select id="tc-as" name="assigneeId" defaultValue={me}>{team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label></div>

          <div className="stick-foot"><SubmitButton pendingText="Creating…">{type === "onboarding" ? "Create and open the quote" : "Create ticket"}</SubmitButton></div>
        </>
      )}
    </form>
  );
}
