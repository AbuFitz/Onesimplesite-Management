"use client";
import { useActionState, useState } from "react";
import { inviteStaffAction } from "@/app/actions/work";
import { ErrorSummary } from "./ui";

export function InviteStaffForm({ roles }: { roles: { value: string; label: string; summary: string }[] }) {
  const [s, act, pending] = useActionState(inviteStaffAction, undefined as { error?: string; link?: string; email?: string } | undefined);
  const [role, setRole] = useState(roles[1]?.value ?? roles[0].value);
  const [copied, setCopied] = useState(false);
  return (
    <div className="max-w-xl">
      <form action={act} className="space-y-3">
        <ErrorSummary message={s?.error} />
        <div><label className="label" htmlFor="tn">Full name</label><input id="tn" name="name" className="field" autoComplete="off" placeholder="First Surname" required /><p className="hint">Their username is made from this: first.surname.</p></div>
        <div><label className="label" htmlFor="te">Email (their login)</label><input id="te" name="email" type="email" inputMode="email" className="field" autoComplete="off" required /></div>
        <div><label className="label" htmlFor="tr">Level</label>
          <select id="tr" name="role" className="field" value={role} onChange={(e) => setRole(e.target.value)}>{roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
          <p className="hint mt-1">{roles.find((r) => r.value === role)?.summary}</p></div>
        <button className="btn" disabled={pending}>{pending ? "Creating…" : "Create login link"}</button>
      </form>
      {s?.link && (
        <div role="status" className="mt-6 border-l-4 border-moss bg-soft px-3 py-3 text-sm">
          <p className="font-semibold">Login link for {s.email}</p>
          <p className="break-all my-2 select-all">{s.link}</p>
          <button type="button" className="btn btn-quiet" onClick={() => navigator.clipboard.writeText(s.link!).then(() => setCopied(true))}>{copied ? "Copied" : "Copy link"}</button>
          <p className="hint mt-2">Shown once. Send it to them yourself; it works once and expires in 7 days. If lost, create a new one for the same email.</p>
        </div>
      )}
    </div>
  );
}
