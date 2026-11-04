"use client";
import { PasswordInput } from "./password-input";
import { useActionState, useEffect, useState } from "react";
import { login, verifyMfa, acceptInvitation } from "@/app/actions/auth";
import { authClient } from "@/lib/auth-client";
import { ErrorSummary } from "./ui";

type LoginState = { error?: string; mfa?: boolean } | undefined;
export function LoginForm({ staff = false, next }: { staff?: boolean; next?: string }) {
  const [s, act, pending] = useActionState(login, undefined as LoginState);
  const [m, mfaAct, mfaPending] = useActionState(verifyMfa, undefined as { error?: string } | undefined);
  const [canPasskey, setCanPasskey] = useState(false);
  const [pkError, setPkError] = useState("");
  const [pkBusy, setPkBusy] = useState(false);
  const [backup, setBackup] = useState(false);
  useEffect(() => { setCanPasskey(typeof window !== "undefined" && !!window.PublicKeyCredential); }, []);

  async function usePasskey() {
    setPkError(""); setPkBusy(true);
    try {
      const r = await authClient(staff ? "staff" : "portal").signIn.passkey();
      if (r?.error) setPkError("We couldn't use a passkey on this device. Sign in with your password instead."); else window.location.href = next ?? (staff ? "/" : "/overview");
    } catch { setPkError("We couldn't use a passkey on this device. Sign in with your password instead."); }
    setPkBusy(false);
  }

  if (s?.mfa) {
    return (
      <form action={mfaAct} className="space-y-4">
        <ErrorSummary message={m?.error} />
        <input type="hidden" name="backup" value={backup ? "1" : "0"} /><input type="hidden" name="next" value={next ?? ""} />
        <p className="text-sm">{backup ? "Enter one of the backup codes you saved when you set up two-step sign-in. Each works once." : "Open your authenticator app and enter the 6-digit code for OneSimpleSite."}</p>
        <div><label className="label" htmlFor="code">{backup ? "Backup code" : "Authenticator code"}</label>
          <input id="code" name="code" className={`field ${backup ? "" : "!text-xl tracking-[0.3em]"}`} inputMode={backup ? "text" : "numeric"} pattern={backup ? undefined : "[0-9 ]*"} maxLength={backup ? 24 : 7} autoComplete="one-time-code" autoFocus required /></div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" name="trust" defaultChecked className="size-5 accent-[#0c6a49]" /><span>Trust this device for 30 days <span className="text-muted">(don't ask again here)</span></span></label>
        <button className="btn w-full" disabled={mfaPending}>{mfaPending ? "Checking…" : "Verify and sign in"}</button>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <button type="button" onClick={() => setBackup(!backup)} className="min-h-10 font-semibold underline">{backup ? "Use my authenticator app" : "Lost your phone? Use a backup code"}</button>
          <a className="min-h-10 py-2 underline" href="/login">Start again</a>
        </div>
        <p className="hint">Still stuck? Ask us to reset it and you'll be guided through setting it up again.</p>
      </form>
    );
  }
  return (
    <div className="space-y-4">
      <form action={act} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
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
