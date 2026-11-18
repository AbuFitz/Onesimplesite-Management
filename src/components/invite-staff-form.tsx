"use client";
import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { inviteStaffAction } from "@/app/actions/work";
import { ErrorSummary } from "./ui";
import { SubmitButton } from "./submit-button";
import { Wizard, type ReviewRow } from "./wizard";

/** Add a team member in three steps: who, what they can do, a check. The result is a one-time login link to send them. */
export function InviteStaffForm({ roles }: { roles: { value: string; label: string; summary: string }[] }) {
  const [s, act] = useActionState(inviteStaffAction, undefined as { error?: string; link?: string; email?: string } | undefined);
  const [role, setRole] = useState(roles[1]?.value ?? roles[0].value);
  const [copied, setCopied] = useState(false);
  const label = (v: string) => (roles.find((r) => r.value === v)?.label ?? "").replace(" (recommended)", "");
  const review = (fd: FormData): ReviewRow[] => [
    { label: "Name", value: String(fd.get("name") ?? ""), step: "who" }, { label: "Email (their login)", value: String(fd.get("email") ?? ""), step: "who" },
    { label: "Access level", value: label(String(fd.get("role") ?? "")), step: "level" },
  ];
  if (s?.link) {
    return (
      <div role="status" className="done-card !text-left">
        <div className="done-tick !mx-0" aria-hidden><Check size={30} /></div>
        <h3 className="mt-4 text-xl font-light">Login link ready for {s.email}</h3>
        <p className="mt-2 break-all rounded-2xl bg-white/70 p-3 text-sm select-all">{s.link}</p>
        <button type="button" className="btn mt-3" onClick={() => navigator.clipboard.writeText(s.link!).then(() => setCopied(true))}>{copied ? "Copied" : "Copy link"}</button>
        <p className="hint mt-3">Shown once. Send it to them yourself; it works once and expires in 7 days. If lost, create a new one for the same email.</p>
      </div>
    );
  }
  return (
    <Wizard action={act} review={review} draftKey="staff-invite" later={{ href: "/settings" }} errorMessage={s?.error} error={<ErrorSummary message={s?.error} />}
      actions={<SubmitButton pendingText="Creating…">Create login link</SubmitButton>}
      steps={[
        { id: "who", title: "Who", hint: "Who is joining the team?", node: (
          <div className="grp">
            <label className="grp-row" htmlFor="tn"><span>Name</span><input id="tn" name="name" autoComplete="off" placeholder="First Surname" required /></label>
            <label className="grp-row" htmlFor="te"><span>Email</span><input id="te" name="email" type="email" inputMode="email" autoComplete="off" placeholder="their login" required /></label>
          </div>) },
        { id: "level", title: "Access", hint: "What should they be able to do? Their username is made from their name: first.surname.", node: (
          <div className="opts" role="radiogroup" aria-label="Access level">
            {roles.map((r) => <label key={r.value} className="opt"><input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} /><span><b>{r.label.replace(" (recommended)", "")}</b><small>{r.summary}</small></span></label>)}
          </div>) },
      ]} />
  );
}
