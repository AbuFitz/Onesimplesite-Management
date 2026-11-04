"use client";
import { PasswordInput } from "./password-input";
import { useActionState, useEffect, useRef, useState } from "react";
import { login, verifyMfa, acceptInvitation, sendLoginCodeAction } from "@/app/actions/auth";
import { authClient } from "@/lib/auth-client";
import { ErrorSummary } from "./ui";

type LoginState = { error?: string; mfa?: "totp" | "otp"; hint?: string } | undefined;
export function LoginForm({ staff = false }: { staff?: boolean }) {
  const [s, act, pending] = useActionState(login, undefined as LoginState);
  const [m, mfaAct, mfaPending] = useActionState(verifyMfa, undefined as { error?: string } | undefined);
  const [note, setNote] = useState("");
  const [cool, setCool] = useState(0);
  const [canPasskey, setCanPasskey] = useState(false);
  const [pkError, setPkError] = useState("");
  const [pkBusy, setPkBusy] = useState(false);
  const sentOnce = useRef(false);
  useEffect(() => { setCanPasskey(typeof window !== "undefined" && !!window.PublicKeyCredential); }, []);
  useEffect(() => { if (cool <= 0) return; const t = setTimeout(() => setCool(cool - 1), 1000); return () => clearTimeout(t); }, [cool]);
  const send = async () => { setNote(""); const r = await sendLoginCodeAction(); if (r.sent) { setNote("A new code is on its way."); setCool(30); } else setNote(r.error ?? ""); };
  useEffect(() => { if (s?.mfa === "otp" && !sentOnce.current) { sentOnce.current = true; setCool(30); void sendLoginCodeAction().then((r) => { if (r.error) setNote(r.error); }); } }, [s?.mfa]);

  async function usePasskey() {
    setPkError(""); setPkBusy(true);
    try {
      const r = await authClient(staff ? "staff" : "portal").signIn.passkey();
      if (r?.error) setPkError("We couldn't use a passkey on this device. Sign in with your password instead."); else window.location.href = staff ? "/" : "/overview";
    } catch { setPkError("We couldn't use a passkey on this device. Sign in with your password instead."); }
    setPkBusy(false);
  }

  if (s?.mfa) {
    const otp = s.mfa === "otp";
    return (
      <form action={mfaAct} className="space-y-4">
        <ErrorSummary message={m?.error} />
        <input type="hidden" name="method" value={s.mfa} />
        <p className="text-sm">{otp ? <>We've emailed a 6-digit code to <strong>{s.hint}</strong>. It works for 10 minutes.</> : "Open your authenticator app and enter the 6-digit code for OneSimpleSite."}</p>
        <div><label className="label" htmlFor="code">{otp ? "Code from your email" : "Authenticator code"}</label>
          <input id="code" name="code" className="field !text-xl tracking-[0.3em]" inputMode="numeric" pattern="[0-9 ]*" maxLength={7} autoComplete="one-time-code" autoFocus required /></div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" name="trust" defaultChecked className="size-5 accent-[#0c6a49]" /><span>Trust this device for 30 days <span className="text-muted">(don't ask again here)</span></span></label>
        <button className="btn w-full" disabled={mfaPending}>{mfaPending ? "Checking…" : "Verify and sign in"}</button>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          {otp && <button type="button" onClick={send} disabled={cool > 0} className="min-h-10 font-semibold underline disabled:no-underline disabled:opacity-60">{cool > 0 ? `Send a new code in ${cool}s` : "Send me a new code"}</button>}
          <a className="min-h-10 py-2 underline" href="/login">Start again</a>
        </div>
        {note && <p role="status" className="text-sm text-muted">{note}</p>}
      </form>
    );
  }
  return (
    <div className="space-y-4">
      <form action={act} className="space-y-4">
        <ErrorSummary message={s?.error} />
        <div><label className="label" htmlFor="email">{staff ? "Username or email" : "Email"}</label>
          <input id="email" name="email" type={staff ? "text" : "email"} className="field" autoComplete="username webauthn" autoCapitalize="none" spellCheck={false} placeholder={staff ? "first.surname" : undefined} required /></div>
        <div><label className="label" htmlFor="password">Password</label>
          <PasswordInput autoComplete="current-password" /></div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" name="remember" defaultChecked={!staff} className="size-5 accent-[#0c6a49]" /><span>Keep me signed in on this device <span className="text-muted">({staff ? "14 days" : "30 days"})</span></span></label>
        <button className="btn w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      </form>
      {canPasskey && (
        <div className="border-t border-line pt-4">
          <button type="button" onClick={usePasskey} disabled={pkBusy} className="btn btn-quiet w-full">{pkBusy ? "Waiting for your device…" : "Sign in with a passkey"}</button>
          <p className="hint mt-2 text-center">Face ID, fingerprint or your phone. No password to type.</p>
          {pkError && <p role="alert" className="mt-2 text-center text-sm font-semibold text-[#7a2e12]">{pkError}</p>}
        </div>
      )}
    </div>
  );
}

export function InviteForm({ token, email, staff }: { token: string; email: string; staff?: { name: string; username: string | null } }) {
  const [s, act, pending] = useActionState(acceptInvitation, undefined as { error?: string } | undefined);
  return (
    <form action={act} className="space-y-4">
      <ErrorSummary message={s?.error} />
      <input type="hidden" name="token" value={token} />
      {staff ? (
        <dl className="text-sm rounded-lg bg-soft px-4 py-3 space-y-1">
          <div className="flex justify-between gap-3"><dt className="text-muted">Name</dt><dd className="font-medium">{staff.name}</dd></div>
          {staff.username && <div className="flex justify-between gap-3"><dt className="text-muted">Username</dt><dd className="font-medium">{staff.username}</dd></div>}
          <div className="flex justify-between gap-3"><dt className="text-muted">Email</dt><dd className="font-medium break-all text-right">{email}</dd></div>
        </dl>
      ) : (
        <>
          <p className="text-sm text-muted">Invitation for <strong className="text-ink break-all">{email}</strong></p>
          <div><label className="label" htmlFor="name">Your name</label><input id="name" name="name" className="field" autoComplete="name" required /></div>
        </>
      )}
      <div><label className="label" htmlFor="password">Choose a password</label>
        <PasswordInput autoComplete="new-password" minLength={12} />
        <p className="hint mt-1">At least 12 characters.</p></div>
      <button className="btn w-full" disabled={pending}>{pending ? "Creating…" : "Create account"}</button>
    </form>
  );
}
