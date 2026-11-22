"use client";
import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { createAgreementAction } from "@/app/actions/agreements";
import { WORK_TYPES } from "@/modules/sales/job-options";
import { ErrorSummary } from "./ui";
import { SubmitButton } from "./submit-button";
import { PendingVeil } from "./wizard";

type P = { id: string; name: string; position: string | null };
/** One screen: what we're building, who signs, and (if you want) a note. Then straight into the agreement, where the price, deposit and offer are set. */
export function AgreementCreateForm({ customer, people }: { customer: { id: string; name: string }; people: P[] }) {
  const [s, act] = useActionState(createAgreementAction, undefined as { error?: string } | undefined);
  const [work, setWork] = useState<string>("simple");
  const [who, setWho] = useState(people[0]?.id ?? "new");
  return (
    <form action={act} className="ac relative">
      <PendingVeil text="Starting the agreement…" />
      <input type="hidden" name="customerId" value={customer.id} /><input type="hidden" name="work" value={work} /><input type="hidden" name="contactId" value={who} />
      <ErrorSummary message={s?.error} />
      <section className="ab-sec" aria-labelledby="ac1"><h2 id="ac1">What are we building?</h2>
        <div className="ac-types" role="radiogroup" aria-label="What are we building">
          {WORK_TYPES.map((w) => (
            <button key={w.id} type="button" role="radio" aria-checked={work === w.id} className={work === w.id ? "on" : ""} onClick={() => setWork(w.id)}>
              <b>{w.label}</b><small>{w.hint}</small>{work === w.id && <Check size={16} aria-hidden />}
            </button>
          ))}
        </div>
      </section>
      <section className="ab-sec" aria-labelledby="ac2"><h2 id="ac2">Who signs?</h2>
        <div className="ab-seg" role="radiogroup" aria-label="Who signs">
          {people.map((p) => <button key={p.id} type="button" role="radio" aria-checked={who === p.id} className={who === p.id ? "on" : ""} onClick={() => setWho(p.id)}>{p.name}{p.position ? ` · ${p.position}` : ""}</button>)}
          <button type="button" role="radio" aria-checked={who === "new"} className={who === "new" ? "on" : ""} onClick={() => setWho("new")}>Someone new</button>
        </div>
        {who === "new" && (
          <div className="grp">
            <label className="grp-row" htmlFor="ag-nn"><span>Name</span><input id="ag-nn" name="newName" required autoComplete="off" placeholder="Their name" /></label>
            <label className="grp-row" htmlFor="ag-ne"><span>Email</span><input id="ag-ne" name="newEmail" type="email" inputMode="email" required autoComplete="off" placeholder="name@company.com" /></label>
            <label className="grp-row" htmlFor="ag-np"><span>Role</span><input id="ag-np" name="newPosition" placeholder="Owner…" /></label>
          </div>
        )}
      </section>
      <details className="ab-sec ab-more"><summary>Add a note <span>optional</span></summary>
        <textarea id="ag-d" name="details" rows={4} className="field mt-3" aria-label="Anything they have asked for" placeholder="Anything they have asked for" />
      </details>
      <div className="ac-go"><SubmitButton pendingText="Starting…">Start the agreement</SubmitButton><p>Price, deposit and any offer come next. Nothing is sent yet.</p></div>
    </form>
  );
}
