"use client";
import { useActionState } from "react";
import { login, verifyMfa, acceptInvitation } from "@/app/actions/auth";
import { ErrorSummary } from "./ui";

export function LoginForm({ staff = false }: { staff?: boolean }) {
  const [s, act, pending] = useActionState(login, undefined as { error?: string; mfa?: boolean } | undefined);
  const [m, mfaAct, mfaPending] = useActionState(verifyMfa, undefined as { error?: string } | undefined);
  if (s?.mfa) {
    return (
      <form action={mfaAct} className="space-y-4">
        <ErrorSummary message={m?.error} />
        <div><label className="label" htmlFor="code">Authenticator code</label>
          <input id="code" name="code" className="field" inputMode="numeric" autoComplete="one-time-code" required /></div>
        <button className="btn w-full" disabled={mfaPending}>{mfaPending ? "Checking…" : "Verify"}</button>
      </form>
    );
  }
  return (
    <form action={act} className="space-y-4">
      <ErrorSummary message={s?.error} />
      <div><label className="label" htmlFor="email">{staff ? "Username or email" : "Email"}</label>
        <input id="email" name="email" type={staff ? "text" : "email"} className="field" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder={staff ? "first.surname" : undefined} required /></div>
      <div><label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" className="field" autoComplete="current-password" required /></div>
      <button className="btn w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function InviteForm({ token, email }: { token: string; email: string }) {
  const [s, act, pending] = useActionState(acceptInvitation, undefined as { error?: string } | undefined);
  return (
    <form action={act} className="space-y-4">
      <ErrorSummary message={s?.error} />
      <input type="hidden" name="token" value={token} />
      <p className="text-sm text-muted">Invitation for <strong className="text-ink break-all">{email}</strong></p>
      <div><label className="label" htmlFor="name">Your name</label><input id="name" name="name" className="field" autoComplete="name" required /></div>
      <div><label className="label" htmlFor="password">Choose a password</label>
        <input id="password" name="password" type="password" className="field" autoComplete="new-password" minLength={12} required />
        <p className="hint mt-1">At least 12 characters.</p></div>
      <button className="btn w-full" disabled={pending}>{pending ? "Creating…" : "Create account"}</button>
    </form>
  );
}
