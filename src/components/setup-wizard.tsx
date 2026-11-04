"use client";
import { useState } from "react";
import QRCode from "qrcode";
import { authClient } from "@/lib/auth-client";

type Step = "start" | "scan" | "codes" | "passkey";

/** The guided setup shown straight after someone's password when two-step sign-in is required and they haven't set it up yet. */
export function SetupWizard({ ns, name }: { ns: "staff" | "portal"; name: string }) {
  const [c] = useState(() => authClient(ns));
  const [step, setStep] = useState<Step>("start");
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");
  const [qr, setQr] = useState(""), [secret, setSecret] = useState("");
  const [backup, setBackup] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const home = ns === "staff" ? "/" : "/overview";

  async function start() {
    setBusy(true); setErr("");
    const r = await c.twoFactor.enable({ password: pw });
    if (r.error || !r.data) setErr("That password isn't right. It's the one you just signed in with.");
    else { const uri = (r.data as { totpURI: string }).totpURI; setBackup((r.data as { backupCodes: string[] }).backupCodes ?? []); setSecret(new URL(uri).searchParams.get("secret") ?? ""); setQr(await QRCode.toDataURL(uri, { margin: 1, width: 220 })); setStep("scan"); }
    setBusy(false); setPw("");
  }
  async function verify() {
    setBusy(true); setErr("");
    const r = await c.twoFactor.verifyTotp({ code: code.replace(/\s+/g, ""), trustDevice: true });
    if (r.error) setErr("That code didn't match. Wait for the next code in your app and try again."); else setStep("codes");
    setBusy(false);
  }
  async function addPasskey() {
    setBusy(true); setErr("");
    try { const r = await c.passkey.addPasskey({ name: "This device" }); if (r?.error) setErr("That didn't work. You can skip this and add one later."); else window.location.href = home; }
    catch { setErr("That didn't work. You can skip this and add one later."); }
    setBusy(false);
  }
  const dots = ["start", "scan", "codes", "passkey"] as const;
  return (
    <div className="space-y-5">
      <ol className="flex gap-1.5" aria-label="Progress">{dots.map((d, i) => <li key={d} className={`h-1.5 flex-1 rounded-full ${i <= dots.indexOf(step) ? "bg-ink" : "bg-line"}`} />)}</ol>
      {err && <p role="alert" className="rounded-lg bg-[#fde6dc] px-3 py-2 text-sm font-semibold text-[#7a2e12]">{err}</p>}

      {step === "start" && (
        <div className="space-y-4">
          <p><strong>Hi {name.split(" ")[0] || "there"}.</strong> To keep your account safe we ask for a code from an app on your phone when you sign in on a new device. It takes about a minute.</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm"><li>Get an authenticator app if you don't have one (1Password, Google Authenticator, Authy, Microsoft Authenticator).</li><li>Scan the code on the next screen.</li><li>Save your backup codes.</li></ol>
          <div><label className="label" htmlFor="sw-p">Confirm your password</label><input id="sw-p" type="password" className="field" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" autoFocus /></div>
          <button type="button" className="btn w-full" onClick={start} disabled={busy || !pw}>{busy ? "One moment…" : "Start setup"}</button>
        </div>
      )}
      {step === "scan" && (
        <div className="space-y-4">
          <p><strong>Scan this with your authenticator app.</strong></p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code to scan with your authenticator app" width={220} height={220} className="mx-auto rounded-xl border border-line" />
          <details className="text-sm"><summary className="cursor-pointer font-semibold">Can't scan? Type the key instead</summary><p className="mt-2 break-all rounded-lg bg-bone p-3 font-mono text-xs">{secret}</p></details>
          <div><label className="label" htmlFor="sw-c">Then enter the 6-digit code your app shows</label><input id="sw-c" className="field !text-xl tracking-[0.3em]" inputMode="numeric" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" /></div>
          <button type="button" className="btn w-full" onClick={verify} disabled={busy || code.replace(/\D/g, "").length < 6}>{busy ? "Checking…" : "Check the code"}</button>
        </div>
      )}
      {step === "codes" && (
        <div className="space-y-4">
          <p><strong>It's on.</strong> Now save your backup codes. If you ever lose your phone, each code lets you in once. They won't be shown again.</p>
          <p className="grid grid-cols-2 gap-1.5 rounded-xl bg-bone p-3 font-mono text-sm sm:grid-cols-3">{backup.map((b) => <span key={b}>{b}</span>)}</p>
          <div className="flex flex-wrap gap-2"><button type="button" className="btn btn-quiet" onClick={() => navigator.clipboard?.writeText(backup.join("\n"))}>Copy codes</button></div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-[#0c6a49]" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I've saved these somewhere safe</label>
          <button type="button" className="btn w-full" disabled={!saved} onClick={() => setStep("passkey")}>Continue</button>
        </div>
      )}
      {step === "passkey" && (
        <div className="space-y-4">
          <p><strong>Optional: add a passkey.</strong> Next time you can sign in with Face ID or a fingerprint instead of typing a password and a code.</p>
          <button type="button" className="btn w-full" onClick={addPasskey} disabled={busy}>{busy ? "Waiting for your device…" : "Add a passkey"}</button>
          <button type="button" className="btn btn-quiet w-full" onClick={() => { window.location.href = home; }}>Skip, take me in</button>
        </div>
      )}
    </div>
  );
}
