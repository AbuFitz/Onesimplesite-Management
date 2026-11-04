"use client";
import { useCallback, useEffect, useState } from "react";
import { KeyRound, Smartphone, Trash2 } from "lucide-react";
import QRCode from "qrcode";
import { authClient } from "@/lib/auth-client";

type Pk = { id: string; name?: string | null; createdAt?: string | null; deviceType?: string; backedUp?: boolean };
const when = (d?: string | null) => (d ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" }).format(new Date(d)) : "");

/** Passkeys and the authenticator app, for the signed-in person. Both are optional extras on top of their password. */
export function SecurityPanel({ ns, hasAuthenticator }: { ns: "staff" | "portal"; hasAuthenticator: boolean }) {
  const [c] = useState(() => authClient(ns));
  const [supported, setSupported] = useState(true);
  const [keys, setKeys] = useState<Pk[] | null>(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [totp, setTotp] = useState<{ uri: string; qr: string; secret: string; backup: string[] } | null>(null);
  const [totpOn, setTotpOn] = useState(hasAuthenticator);
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");

  const load = useCallback(async () => { const r = await c.$fetch<Pk[]>("/passkey/list-user-passkeys", { method: "GET" }); setKeys(r.error ? [] : (r.data ?? [])); }, [c]);
  useEffect(() => { setSupported(!!window.PublicKeyCredential); void load(); }, [load]);
  const say = (kind: "ok" | "bad", text: string) => setMsg({ kind, text });

  async function addKey() {
    setBusy(true); setMsg(null);
    try { const r = await c.passkey.addPasskey({ name: name.trim() || "This device" }); if (r?.error) say("bad", "That didn't work. You can cancel and try again."); else { say("ok", "Passkey added. Next time, choose “Sign in with a passkey”."); setName(""); await load(); } }
    catch { say("bad", "That didn't work. You can cancel and try again."); }
    setBusy(false);
  }
  async function removeKey(id: string) {
    if (!confirm("Remove this passkey? You can still sign in with your password.")) return;
    await c.$fetch("/passkey/delete-passkey", { method: "POST", body: { id } }); await load();
  }
  async function startTotp() {
    setBusy(true); setMsg(null);
    const r = await c.twoFactor.enable({ password: pw });
    if (r.error || !r.data) say("bad", "Your password is incorrect."); else {
      const uri = (r.data as { totpURI: string }).totpURI;
      setTotp({ uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 200 }), secret: new URL(uri).searchParams.get("secret") ?? "", backup: (r.data as { backupCodes: string[] }).backupCodes ?? [] });
    }
    setBusy(false); setPw("");
  }
  async function confirmTotp() {
    setBusy(true);
    const r = await c.twoFactor.verifyTotp({ code: code.replace(/\s+/g, "") });
    if (r.error) say("bad", "That code didn't match. Try the next one in your app."); else { setTotpOn(true); say("ok", "Authenticator app is on. Keep your backup codes somewhere safe."); }
    setBusy(false); setCode("");
  }
  async function stopTotp() {
    setBusy(true);
    const r = await c.twoFactor.disable({ password: pw });
    if (r.error) say("bad", "Your password is incorrect."); else { setTotpOn(false); setTotp(null); say("ok", "Authenticator app turned off."); }
    setBusy(false); setPw("");
  }

  return (
    <div className="space-y-6">
      {msg && <p role={msg.kind === "bad" ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-sm font-semibold ${msg.kind === "bad" ? "bg-[#fde6dc] text-[#7a2e12]" : "bg-[#e9f6ef] text-[#0a5a3d]"}`}>{msg.text}</p>}

      <section aria-labelledby="pk">
        <h3 id="pk" className="flex items-center gap-2 text-lg font-bold"><KeyRound size={18} aria-hidden /> Passkeys</h3>
        <p className="mt-1 text-sm text-muted">Sign in with Face ID, a fingerprint or your phone instead of typing a password. The safest option, and it can't be phished.</p>
        {keys === null ? <p className="mt-3 text-sm text-muted">Loading…</p> : keys.length === 0 ? <p className="mt-3 text-sm text-muted">No passkeys yet.</p> : (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-white">{keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span><strong>{k.name || "Passkey"}</strong><span className="block text-muted">Added {when(k.createdAt)}{k.backedUp ? " · synced across your devices" : ""}</span></span>
              <button type="button" onClick={() => removeKey(k.id)} aria-label={`Remove ${k.name || "passkey"}`} className="grid size-10 place-items-center rounded-lg hover:bg-bone"><Trash2 size={16} aria-hidden /></button></li>))}</ul>
        )}
        {supported ? (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div><label className="label" htmlFor="pk-n">Name it <span className="font-normal text-muted">(so you can tell them apart)</span></label><input id="pk-n" className="field !min-h-11 w-60" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My iPhone" maxLength={40} /></div>
            <button type="button" onClick={addKey} disabled={busy} className="btn">{busy ? "Waiting for your device…" : "Add a passkey"}</button>
          </div>
        ) : <p className="mt-3 text-sm text-muted">This browser can't create passkeys. Try your phone or a newer browser.</p>}
      </section>

      <section aria-labelledby="au">
        <h3 id="au" className="flex items-center gap-2 text-lg font-bold"><Smartphone size={18} aria-hidden /> Authenticator app</h3>
        <p className="mt-1 text-sm text-muted">Use an app like 1Password, Google Authenticator or Authy for a 6-digit code when you sign in on a new device. {totpOn ? "It's on." : ""}</p>
        {!totp && !totpOn && (
          <div className="mt-3 flex flex-wrap items-end gap-3"><div><label className="label" htmlFor="au-p">Your password</label><input id="au-p" type="password" className="field !min-h-11 w-60" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></div><button type="button" onClick={startTotp} disabled={busy || !pw} className="btn btn-quiet">Set up</button></div>
        )}
        {totp && !totpOn && (
          <div className="mt-3 space-y-3 rounded-xl border border-line bg-white p-4 text-sm">
            <p><strong>1.</strong> Scan this with your app (or type the key).</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={totp.qr} alt="QR code to scan with your authenticator app" width={200} height={200} className="rounded-lg border border-line" />
            <p className="break-all font-mono text-xs">Key: {totp.secret}</p>
            <p><strong>2.</strong> Enter the 6-digit code your app shows.</p>
            <div className="flex flex-wrap items-end gap-3"><input aria-label="6-digit code" className="field !min-h-11 w-40 tracking-[0.3em]" inputMode="numeric" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" /><button type="button" onClick={confirmTotp} disabled={busy || code.replace(/\D/g, "").length < 6} className="btn">Turn on</button></div>
            {totp.backup.length > 0 && <div><p><strong>Backup codes</strong> (each works once, if you lose your phone). Save them now, they won't be shown again:</p><p className="mt-1 grid grid-cols-2 gap-1 font-mono text-xs sm:grid-cols-5">{totp.backup.map((b) => <span key={b}>{b}</span>)}</p></div>}
          </div>
        )}
        {totpOn && (
          <div className="mt-3 flex flex-wrap items-end gap-3"><div><label className="label" htmlFor="au-p2">Your password</label><input id="au-p2" type="password" className="field !min-h-11 w-60" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></div><button type="button" onClick={stopTotp} disabled={busy || !pw} className="btn btn-quiet">Turn off</button></div>
        )}
      </section>
    </div>
  );
}
