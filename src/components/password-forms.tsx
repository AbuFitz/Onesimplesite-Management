"use client";
import { useActionState } from "react";
import Link from "next/link";
import { changePassword, requestReset, resetPassword } from "@/app/actions/auth";
import { ErrorSummary } from "./ui";

const Field = ({ id, label, type = "password", auto }: { id: string; label: string; type?: string; auto: string }) => (
  <div><label className="label" htmlFor={id}>{label}</label><input id={id} name={id} type={type} className="field" autoComplete={auto} required /></div>
);

export function ChangePasswordForm() {
  const [s, act, pending] = useActionState(changePassword, undefined as { error?: string; done?: boolean } | undefined);
  return (
    <form action={act} className="max-w-sm space-y-3">
      <ErrorSummary message={s?.error} />
      {s?.done && <p role="status" className="text-sm text-moss">Password changed. Other devices have been signed out.</p>}
      <Field id="current" label="Current password" auto="current-password" />
      <Field id="next" label="New password (12+ characters)" auto="new-password" />
      <Field id="confirm" label="Repeat new password" auto="new-password" />
      <button className="btn" disabled={pending}>{pending ? "Saving…" : "Change password"}</button>
    </form>
  );
}

export function ForgotForm() {
  const [s, act, pending] = useActionState(requestReset, undefined as { error?: string; sent?: boolean } | undefined);
  if (s?.sent) return <p role="status">If that email has an account, a reset link is on its way. It works once and expires in an hour.</p>;
  return (
    <form action={act} className="space-y-3">
      <ErrorSummary message={s?.error} />
      <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" className="field" autoComplete="username" required /></div>
      <button className="btn w-full" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</button>
      <p className="hint"><Link className="underline" href="/login">Back to sign in</Link></p>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [s, act, pending] = useActionState(resetPassword, undefined as { error?: string; done?: boolean } | undefined);
  if (s?.done) return <p role="status">Password updated. <Link className="underline" href="/login">Sign in</Link></p>;
  return (
    <form action={act} className="space-y-3">
      <ErrorSummary message={s?.error} />
      <input type="hidden" name="token" value={token} />
      <Field id="next" label="New password (12+ characters)" auto="new-password" />
      <Field id="confirm" label="Repeat new password" auto="new-password" />
      <button className="btn w-full" disabled={pending}>{pending ? "Saving…" : "Set new password"}</button>
    </form>
  );
}
