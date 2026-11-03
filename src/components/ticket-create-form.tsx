"use client";
import { useActionState, useState } from "react";
import { Globe, Wrench, LifeBuoy } from "lucide-react";
import { createTicketStaffAction } from "@/app/actions/tickets";
import { TICKET_KINDS } from "@/modules/support/options";
import { WORK_TYPES } from "@/modules/sales/job-options";
import { ErrorSummary } from "./ui";
import { SubmitButton } from "./submit-button";

const TYPES = [
  { id: "onboarding", label: "New website", hint: "A new customer or a new site. We quote it, they sign, we set up payment.", Icon: Globe, tone: "bg-[#dff5ea]" },
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
    <form action={act} className="max-w-3xl space-y-8">
      <ErrorSummary message={s?.error} />
      <input type="hidden" name="customerId" value={customer.id} /><input type="hidden" name="type" value={type} />

      <fieldset>
        <legend className="mb-3 text-xl font-bold">What kind of ticket is it?</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {TYPES.map(({ id, label, hint, Icon, tone }) => (
            <button type="button" key={id} aria-pressed={type === id} onClick={() => setType(id)} className={`flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-colors ${type === id ? "border-ink " + tone : "border-line bg-white hover:bg-bone"}`}>
              <span className={`grid size-10 place-items-center rounded-xl ${tone}`}><Icon size={20} aria-hidden /></span>
              <span className="font-bold">{label}</span><span className="text-sm text-muted">{hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {type && (
        <>
          <section className="space-y-4" aria-label="Who">
            <div><label className="label" htmlFor="tc-p">Who got in touch?</label>
              <select id="tc-p" name="contactId" className="field" value={who} onChange={(e) => setWho(e.target.value)}>{people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.position ? `, ${p.position}` : ""}</option>)}<option value="new">Someone new at {customer.name}…</option></select></div>
            {who === "new" && (
              <div className="grid gap-3 rounded-xl bg-bone/70 p-4 sm:grid-cols-3">
                <div><label className="label" htmlFor="tc-nn">Their name</label><input id="tc-nn" name="newName" className="field" required autoComplete="off" /></div>
                <div><label className="label" htmlFor="tc-ne">Their email</label><input id="tc-ne" name="newEmail" type="email" className="field" required autoComplete="off" /></div>
                <div><label className="label" htmlFor="tc-np">Their role</label><input id="tc-np" name="newPosition" className="field" placeholder="Manager…" /></div>
              </div>
            )}
          </section>

          <section className="space-y-4" aria-label="Details">
            {type === "onboarding" && <div><label className="label" htmlFor="tc-w">What do they want?</label><select id="tc-w" name="work" className="field" defaultValue="simple">{WORK_TYPES.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}</select></div>}
            {type === "support" && <div><label className="label" htmlFor="tc-k">What is it?</label><select id="tc-k" name="kind" className="field" defaultValue="issue">{TICKET_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></div>}
            <div><label className="label" htmlFor="tc-t">Short title {type === "onboarding" && <span className="font-normal text-muted">(optional)</span>}</label><input id="tc-t" name="title" className="field" maxLength={140} required={type !== "onboarding"} autoComplete="off" /></div>
            <div><label className="label" htmlFor="tc-d">{type === "onboarding" ? "What did they say they want?" : "What happened, or what do they want changed?"}</label><textarea id="tc-d" name="details" rows={5} className="field" required={type !== "onboarding"} /></div>
          </section>

          {type === "change_request" && (
            <fieldset className="space-y-3 rounded-2xl border border-line bg-white p-4">
              <legend className="px-1 font-bold">Is there a cost?</legend>
              {[["later", "I'll decide the price later"], ["included", "No charge. It's covered by their plan"], ["charge", "Charge for it"]].map(([v, l]) => (
                <label key={v} className="flex items-center gap-2"><input type="radio" name="cost" value={v} checked={cost === v} onChange={() => setCost(v)} className="accent-[#0c6a49]" /> {l}</label>
              ))}
              {cost === "charge" && (
                <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                  <div><label className="label" htmlFor="tc-pr">Price (£)</label><input id="tc-pr" name="price" type="number" min="1" step="0.01" inputMode="decimal" className="field" required /></div>
                  <div><label className="label" htmlFor="tc-cn">Note for them <span className="font-normal text-muted">(optional)</span></label><input id="tc-cn" name="costNote" className="field" placeholder="Includes setup and testing" /></div>
                  <p className="text-sm text-muted sm:col-span-2">They get an email to approve this price in their portal. Nothing starts until they say yes, then they can pay by card.</p>
                </div>
              )}
            </fieldset>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="tc-pri">Priority</label><select id="tc-pri" name="priority" className="field" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
            <div><label className="label" htmlFor="tc-as">Owner</label><select id="tc-as" name="assigneeId" className="field" defaultValue={me}>{team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
          </div>
          <SubmitButton pendingText="Creating…">{type === "onboarding" ? "Create and open the quote" : "Create ticket"}</SubmitButton>
        </>
      )}
    </form>
  );
}
