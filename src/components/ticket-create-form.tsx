"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { useModalClose } from "./modal-context";
import { toast } from "./toaster";
import { createTicketStaffAction } from "@/app/actions/tickets";
import { ErrorSummary } from "./ui";
import { SubmitButton } from "./submit-button";
import { PendingVeil } from "./wizard";

const TYPES = [
  { id: "support", label: "Support", hint: "Something to fix or answer. Included in their plan." },
  { id: "change_request", label: "Change", hint: "Extra work. We price it, they approve it, then pay." },
] as const;
const PRIORITIES = [["low", "Low"], ["normal", "Normal"], ["high", "High"], ["urgent", "Urgent"]] as const;

type P = { id: string; name: string; position: string | null };
/**
 * One screen. The type is already chosen for you (Support), the person who got in touch is the main contact, and the owner is you:
 * you only have to say what the problem is. Anything else (cost for a change, priority, owner) appears only when it matters or under "More".
 */
export function TicketCreateForm({ customer, people, team, me, initialType }: { customer: { id: string; name: string }; people: P[]; team: { id: string; name: string }[]; me: string; initialType?: string }) {
  const [s, act] = useActionState(createTicketStaffAction, undefined as { error?: string; ok?: true; id?: string; title?: string } | undefined);
  const closeModal = useModalClose();
  const router = useRouter();
  useEffect(() => { if (s?.ok && s.id && closeModal) { toast({ text: "Ticket created", href: `/support/${s.id}`, label: "Open" }); closeModal(); window.setTimeout(() => router.refresh(), 350); } }, [s]); // eslint-disable-line react-hooks/exhaustive-deps
  const [type, setType] = useState<string>(TYPES.some((t) => t.id === initialType) ? initialType! : "support");
  const [who, setWho] = useState(people[0]?.id ?? "new");
  const [cost, setCost] = useState("later");
  const [priority, setPriority] = useState("normal");
  return (
    <form action={act} className="tcf relative">
      <PendingVeil text="Creating the ticket…" />
      <input type="hidden" name="customerId" value={customer.id} /><input type="hidden" name="type" value={type} /><input type="hidden" name="contactId" value={who} />
      <input type="hidden" name="kind" value={type === "change_request" ? "request" : "issue"} /><input type="hidden" name="priority" value={priority} />
      {closeModal && <input type="hidden" name="inModal" value="1" />}
      <ErrorSummary message={s?.error} />
      <p className="tcf-for">For <b>{customer.name}</b>{!closeModal && <> · <Link href="/tickets/new">change</Link></>}</p>

      <div className="ab-seg tcf-type" role="radiogroup" aria-label="Kind of ticket">
        {TYPES.map((t) => <button key={t.id} type="button" role="radio" aria-checked={type === t.id} className={type === t.id ? "on" : ""} onClick={() => setType(t.id)}>{t.label}</button>)}
      </div>
      <p className="ab-hint">{TYPES.find((t) => t.id === type)?.hint}</p>

      <div className="tcf-box">
        <label className="sr-only" htmlFor="tc-t">Title</label>
        <input id="tc-t" name="title" className="evf-title" placeholder={type === "change_request" ? "What needs changing?" : "What's wrong?"} maxLength={140} autoComplete="off" autoFocus />
        <label className="sr-only" htmlFor="tc-d">Details</label>
        <textarea id="tc-d" name="details" rows={5} className="field" placeholder="Details. No title? The first line becomes it." required />
      </div>

      <section className="tcf-sec"><h3>Customer contact</h3>
        <div className="ab-seg" role="radiogroup" aria-label="Customer contact">
          {people.map((p) => <button key={p.id} type="button" role="radio" aria-checked={who === p.id} className={who === p.id ? "on" : ""} onClick={() => setWho(p.id)}>{p.name}{p.position ? ` · ${p.position}` : ""}</button>)}
          <button type="button" role="radio" aria-checked={who === "new"} className={who === "new" ? "on" : ""} onClick={() => setWho("new")}>Someone new</button>
        </div>
        {who === "new" && (
          <div className="grp">
            <label className="grp-row" htmlFor="tc-nn"><span>Name</span><input id="tc-nn" name="newName" required autoComplete="off" placeholder="Their name" /></label>
            <label className="grp-row" htmlFor="tc-ne"><span>Email</span><input id="tc-ne" name="newEmail" type="email" inputMode="email" required autoComplete="off" placeholder="name@company.com" /></label>
            <label className="grp-row" htmlFor="tc-np"><span>Role</span><input id="tc-np" name="newPosition" placeholder="Manager…" /></label>
          </div>
        )}
      </section>

      {type === "change_request" && (
        <section className="tcf-sec"><h3>Price</h3>
          <input type="hidden" name="cost" value={cost} />
          <div className="ab-seg" role="radiogroup" aria-label="Cost">
            {[["later", "Set later"], ["included", "Free"], ["charge", "Charge"]].map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={cost === v} className={cost === v ? "on" : ""} onClick={() => setCost(v)}>{l}</button>)}
          </div>
          {cost === "charge" && (
            <div className="grp">
              <label className="grp-row" htmlFor="tc-pr"><span>Price (£)</span><input id="tc-pr" name="price" type="number" min="1" step="0.01" inputMode="decimal" required placeholder="0.00" /></label>
              <label className="grp-row" htmlFor="tc-cn"><span>Note</span><input id="tc-cn" name="costNote" placeholder="Optional. They approve the price in the portal first." /></label>
            </div>
          )}
        </section>
      )}

      <details className="tcf-more"><summary>Priority and owner</summary>
        <div className="tcf-sec"><h3>Urgency</h3>
          <div className="ab-seg" role="radiogroup" aria-label="Priority">{PRIORITIES.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={priority === v} className={priority === v ? "on" : ""} onClick={() => setPriority(v)}>{l}</button>)}</div>
        </div>
        <div className="grp"><label className="grp-row" htmlFor="tc-as"><span>Owner</span><select id="tc-as" name="assigneeId" defaultValue={me}>{team.map((m) => <option key={m.id} value={m.id}>{m.name}{m.id === me ? " (you)" : ""}</option>)}</select></label></div>
      </details>

      <div className="tcf-go"><SubmitButton pendingText="Creating…">Create ticket</SubmitButton>{closeModal && <button type="button" className="btn btn-quiet" onClick={closeModal}>Cancel</button>}</div>
    </form>
  );
}
