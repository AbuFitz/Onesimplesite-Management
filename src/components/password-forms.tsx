"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { changePassword, requestReset, resetPassword } from "@/app/actions/auth";
import { ErrorSummary } from "./ui";

function useReveal() { const [show, setShow] = useState(false); return { type: show ? "text" : "password", toggle: (
  <label className="flex items-center gap-2 min-h-11 text-sm"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords</label>) }; }

const Field = ({ id, label, type, auto, hint }: { id: string; label: string; type: string; auto: string; hint?: string }) => (
  <div><label className="label" htmlFor={id}>{label}</label><input id={id} name={id} type={type} className="field" autoComplete={auto} required minLength={id === "current" ? undefined : 12} />{hint && <p className="hint mt-1">{hint}</p>}</div>
);

export function ChangePasswordForm() {
  const [s, act, pending] = useActionState(changePassword, undefined as { error?: string; done?: boolean } | undefined);
  const r = useReveal();
  return (
    <form action={act} className="max-w-sm space-y-3">
      <ErrorSummary message={s?.error} />
      {s?.done && <p role="status" className="text-sm text-moss">Password changed. Other devices have been signed out.</p>}
      <Field id="current" label="Current password" type={r.type} auto="current-password" />
      <Field id="next" label="New password" type={r.type} auto="new-password" hint="At least 12 characters. A few random words works well." />
      <Field id="confirm" label="Repeat new password" type={r.type} auto="new-password" />
      {r.toggle}
      <button className="btn" disabled={pending}>{pending ? "Saving…" : "Change password"}</button>
    </form>
  );
}

export function ForgotForm() {
  const [s, act, pending] = useActionState(requestReset, undefined as { error?: string; sent?: boolean } | undefined);
  if (s?.sent) {
    return (
      <div role="status" className="space-y-3">
        <p className="font-semibold">Check your inbox</p>
        <p>If that email has an account, a reset link is on its way. It works once and expires in an hour. It can take a minute to arrive, so check spam too.</p>
        <p><Link className="underline" href="/login">Back to sign in</Link></p>
      </div>
    );
  }
  return (
    <form action={act} className="space-y-4">
      <ErrorSummary message={s?.error} />
      <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" inputMode="email" className="field" autoComplete="username" required /></div>
      <button className="btn w-full" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</button>
      <p className="text-sm"><Link className="underline" href="/login">Back to sign in</Link></p>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [s, act, pending] = useActionState(resetPassword, undefined as { error?: string; done?: boolean } | undefined);
  const r = useReveal();
  if (s?.done) {
    return (
      <div role="status" className="space-y-4">
        <p className="font-semibold">Your password is updated</p>
        <p>You've been signed out everywhere. Sign in with your new password.</p>
        <Link className="btn w-full sm:w-auto" href="/login">Go to sign in</Link>
      </div>
    );
  }
  return (
    <form action={act} className="space-y-4">
      <ErrorSummary message={s?.error} />
      <input type="hidden" name="token" value={token} />
      <Field id="next" label="New password" type={r.type} auto="new-password" hint="At least 12 characters." />
      <Field id="confirm" label="Repeat new password" type={r.type} auto="new-password" />
      {r.toggle}
      <button className="btn w-full" disabled={pending}>{pending ? "Saving…" : "Set new password"}</button>
    </form>
  );
}
