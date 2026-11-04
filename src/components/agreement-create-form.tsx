"use client";
import { useActionState, useState } from "react";
import { createAgreementAction } from "@/app/actions/agreements";
import { WORK_TYPES } from "@/modules/sales/job-options";
import { ErrorSummary } from "./ui";
import { SubmitButton } from "./submit-button";

type P = { id: string; name: string; position: string | null };
/** Three questions, then straight into the agreement. Price, deposit and any offer are set on the next page. */
export function AgreementCreateForm({ customer, people }: { customer: { id: string; name: string }; people: P[] }) {
  const [s, act] = useActionState(createAgreementAction, undefined as { error?: string } | undefined);
  const [who, setWho] = useState(people[0]?.id ?? "new");
  return (
    <form action={act} className="max-w-2xl space-y-5">
      <ErrorSummary message={s?.error} />
      <input type="hidden" name="customerId" value={customer.id} />
      <div><label className="label" htmlFor="ag-w">What are we building for them?</label><select id="ag-w" name="work" className="field" defaultValue="simple">{WORK_TYPES.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}</select></div>
      <div><label className="label" htmlFor="ag-p">Who signs?</label>
        <select id="ag-p" name="contactId" className="field" value={who} onChange={(e) => setWho(e.target.value)}>{people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.position ? `, ${p.position}` : ""}</option>)}<option value="new">Someone new at {customer.name}…</option></select></div>
      {who === "new" && (
        <div className="grid gap-3 rounded-xl bg-bone/70 p-4 sm:grid-cols-3">
          <div><label className="label" htmlFor="ag-nn">Their name</label><input id="ag-nn" name="newName" className="field" required autoComplete="off" /></div>
          <div><label className="label" htmlFor="ag-ne">Their email</label><input id="ag-ne" name="newEmail" type="email" className="field" required autoComplete="off" /></div>
          <div><label className="label" htmlFor="ag-np">Their role</label><input id="ag-np" name="newPosition" className="field" placeholder="Owner…" /></div>
        </div>
      )}
      <div><label className="label" htmlFor="ag-d">Anything they've asked for <span className="font-normal text-muted">(optional)</span></label><textarea id="ag-d" name="details" rows={4} className="field" /></div>
      <SubmitButton pendingText="Starting…">Start the agreement</SubmitButton>
    </form>
  );
}
