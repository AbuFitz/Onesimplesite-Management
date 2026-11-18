"use client";
import { useActionState, useState } from "react";
import { createAgreementAction } from "@/app/actions/agreements";
import { WORK_TYPES } from "@/modules/sales/job-options";
import { ErrorSummary } from "./ui";
import { SubmitButton } from "./submit-button";
import { Wizard, type ReviewRow } from "./wizard";

type P = { id: string; name: string; position: string | null };
/** Three short steps and a check, then straight into the agreement. Price, deposit and any offer are set on the next page. */
export function AgreementCreateForm({ customer, people }: { customer: { id: string; name: string }; people: P[] }) {
  const [s, act] = useActionState(createAgreementAction, undefined as { error?: string } | undefined);
  const [who, setWho] = useState(people[0]?.id ?? "new");
  const review = (fd: FormData): ReviewRow[] => {
    const cid = String(fd.get("contactId") ?? "");
    const signer = cid === "new" ? `${fd.get("newName") ?? ""} (${fd.get("newEmail") ?? ""})` : people.find((p) => p.id === cid)?.name ?? "";
    return [
      { label: "Company", value: customer.name, step: "work" },
      { label: "What we are building", value: WORK_TYPES.find((w) => w.id === String(fd.get("work") ?? ""))?.label ?? "", step: "work" },
      { label: "Who signs", value: signer, step: "who" },
      { label: "What they asked for", value: String(fd.get("details") ?? "").slice(0, 280), step: "notes" },
    ];
  };
  return (
    <Wizard action={act} review={review} draftKey={`agreement:${customer.id}`} later={{ href: "/agreements" }} errorMessage={s?.error} error={<ErrorSummary message={s?.error} />}
      intro={<p className="wz-hint">Four quick steps, then you set the price, deposit and any offer on the next page before anything is sent.</p>}
      actions={<SubmitButton pendingText="Starting…">Start the agreement</SubmitButton>}
      steps={[
        { id: "work", title: "Work", hint: "What are we building for them?", node: (<><input type="hidden" name="customerId" value={customer.id} /><select id="ag-w" name="work" className="field" defaultValue="simple" aria-label="What are we building for them?">{WORK_TYPES.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}</select></>) },
        { id: "who", title: "Signer", hint: "Who signs for the company?", node: (<>
          <select id="ag-p" name="contactId" className="field" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Who signs?">{people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.position ? `, ${p.position}` : ""}</option>)}<option value="new">Someone new at {customer.name}…</option></select>
          {who === "new" && (
            <div className="grp">
              <label className="grp-row" htmlFor="ag-nn"><span>Name</span><input id="ag-nn" name="newName" required autoComplete="off" placeholder="Their name" /></label>
              <label className="grp-row" htmlFor="ag-ne"><span>Email</span><input id="ag-ne" name="newEmail" type="email" inputMode="email" required autoComplete="off" placeholder="name@company.com" /></label>
              <label className="grp-row" htmlFor="ag-np"><span>Role</span><input id="ag-np" name="newPosition" placeholder="Owner…" /></label>
            </div>
          )}</>) },
        { id: "notes", title: "Notes", hint: "Anything they have asked for? You can skip this.", node: <textarea id="ag-d" name="details" rows={5} className="field" aria-label="Anything they have asked for" /> },
      ]} />
  );
}
