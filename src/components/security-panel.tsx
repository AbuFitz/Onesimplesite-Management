"use client";
import { useCallback, useEffect, useState } from "react";
import { KeyRound, Smartphone, Trash2, ShieldCheck, ShieldAlert, ChevronRight, Copy, Download } from "lucide-react";
import { Sheet } from "./sheet";
import QRCode from "qrcode";
import { authClient } from "@/lib/auth-client";
import { useConfirm } from "./confirm";

type Pk = { id: string; name?: string | null; createdAt?: string | null; deviceType?: string; backedUp?: boolean };
const when = (d?: string | null) => (d ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" }).format(new Date(d)) : "");

/** Passkeys and the authenticator app, for the signed-in person. Both are optional extras on top of their password. */
export function SecurityPanel({ ns, hasAuthenticator }: { ns: "staff" | "portal"; hasAuthenticator: boolean }) {
  const [c] = useState(() => authClient(ns));
  const { ask, node: confirmNode } = useConfirm();
  const [supported, setSupported] = useState(true);
  const [keys, setKeys] = useState<Pk[] | null>(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [totp, setTotp] = useState<{ uri: string; qr: string; secret: string; backup: string[] } | null>(null);
  const [totpOn, setTotpOn] = useState(hasAuthenticator);
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");
  const [phoneQr, setPhoneQr] = useState("");
  const [fromPhone, setFromPhone] = useState(false);
  const [view, setView] = useState<"pk" | "au" | null>(null);
  const [showCodes, setShowCodes] = useState(false);

  const load = useCallback(async () => { const r = await c.$fetch<Pk[]>("/passkey/list-user-passkeys", { method: "GET" }); setKeys(r.error ? [] : (r.data ?? [])); }, [c]);
  useEffect(() => { setSupported(!!window.PublicKeyCredential); void load(); }, [load]);
  // A code that opens this same page on a phone (after they sign in there), ready to add a passkey to that phone.
  useEffect(() => {
    const here = `${window.location.origin}${window.location.pathname}?passkey=phone#pk`;
    void QRCode.toDataURL(here, { margin: 1, width: 360, color: { dark: "#0E1311", light: "#ffffff" } }).then(setPhoneQr);
    if (new URLSearchParams(window.location.search).get("passkey") === "phone") { setFromPhone(true); setName("My phone"); }
  }, []);
  const say = (kind: "ok" | "bad", text: string) => setMsg({ kind, text });

  async function addKey() {
    setBusy(true); setMsg(null);
    try { const r = await c.passkey.addPasskey({ name: name.trim() || "This device" }); if (r?.error) say("bad", "That didn't work. You can cancel and try again."); else { say("ok", "Passkey added. Next time, choose “Sign in with a passkey”."); setName(""); await load(); } }
    catch { say("bad", "That didn't work. You can cancel and try again."); }
    setBusy(false);
  }
  async function removeKey(id: string) {
    if (!(await ask("Remove this passkey? You can still sign in with your password.", { title: "Remove passkey", confirmLabel: "Remove" }))) return;
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
    if (r.error) say("bad", "That code didn't match. Try the next one in your app."); else { setTotpOn(true); setShowCodes(true); say("ok", "Authenticator app is on."); }
    setBusy(false); setCode("");
  }
  async function stopTotp() {
    setBusy(true);
    const r = await c.twoFactor.disable({ password: pw });
    if (r.error) say("bad", "Your password is incorrect."); else { setTotpOn(false); setTotp(null); say("ok", "Authenticator app turned off."); }
    setBusy(false); setPw("");
  }

  const nKeys = keys?.length ?? 0;
  const protectedNow = nKeys > 0 || totpOn;
  const codesText = (totp?.backup ?? []).join("\n");
  const downloadCodes = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([`OneSimpleSite backup codes\nEach works once.\n\n${codesText}\n`], { type: "text/plain" })); a.download = "backup-codes.txt"; a.click(); };
  const closeAu = () => { setView(null); if (showCodes) { setShowCodes(false); setTotp(null); } };
  const flash = msg && <p role={msg.kind === "bad" ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-sm font-semibold ${msg.kind === "bad" ? "bg-[#fde6dc] text-[#7a2e12]" : "bg-[#e9f6ef] text-[#0a5a3d]"}`}>{msg.text}</p>;

  return (
    <div className="space-y-4">
      {confirmNode}
      <div className={`sec-card ${protectedNow ? "ok" : ""}`}>
        <span aria-hidden>{protectedNow ? <ShieldCheck size={26} /> : <ShieldAlert size={26} />}</span>
        <div><b>{protectedNow ? "You have a second step" : "Add a second step"}</b><small>{protectedNow ? "A new device has to prove it's you." : "A passkey takes about ten seconds."}</small></div>
      </div>
      {!view && flash}
      <ul className="set-rows">
        <li><button type="button" className="set-row" onClick={() => { setMsg(null); setView("pk"); }}><span className="set-ico" style={{ background: "#4a6024" }} aria-hidden><KeyRound size={19} /></span><span className="set-txt"><b>Passkey</b><small>Face ID, fingerprint or your phone</small></span><em className="set-st">{keys === null ? "" : nKeys ? `${nKeys} saved` : "Not set up"}</em><ChevronRight size={18} className="set-chev" aria-hidden /></button></li>
        <li><button type="button" className="set-row" onClick={() => { setMsg(null); setView("au"); }}><span className="set-ico" style={{ background: "#3b6ea5" }} aria-hidden><Smartphone size={19} /></span><span className="set-txt"><b>Authenticator app</b><small>A 6-digit code from an app</small></span><em className="set-st">{totpOn ? "On" : "Off"}</em><ChevronRight size={18} className="set-chev" aria-hidden /></button></li>
      </ul>

      <Sheet open={view === "pk"} onClose={() => setView(null)} title="Passkey">
        <div className="space-y-4">
          <p className="text-sm text-muted">Sign in with Face ID or a fingerprint. Nothing to type, and it can&apos;t be phished.</p>
          {flash}
          {keys !== null && keys.length > 0 && (
            <ul className="divide-y divide-line rounded-2xl border border-line bg-white">{keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span><strong>{k.name || "Passkey"}</strong><span className="block text-muted">Added {when(k.createdAt)}{k.backedUp ? " · synced" : ""}</span></span>
                <button type="button" onClick={() => removeKey(k.id)} aria-label={`Remove ${k.name || "passkey"}`} className="grid size-10 place-items-center rounded-lg hover:bg-bone"><Trash2 size={16} aria-hidden /></button></li>))}</ul>
          )}
          {fromPhone && supported && <p role="status" className="rounded-lg bg-[#e9f6ef] px-3 py-2 text-sm font-semibold text-[#0a5a3d]">You&apos;re on your phone. Tap Add a passkey.</p>}
          {supported ? (
            <div className="space-y-3">
              <div><label className="label" htmlFor="pk-n">Name</label><input id="pk-n" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My iPhone" maxLength={40} /></div>
              <button type="button" onClick={addKey} disabled={busy} className="btn w-full justify-center">{busy ? "Waiting for your device…" : "Add a passkey"}</button>
            </div>
          ) : <p className="text-sm text-muted">This browser can&apos;t create passkeys. Try your phone.</p>}
          {phoneQr && !fromPhone && (
            <div className="hidden items-center gap-4 rounded-2xl bg-white/70 p-3 md:flex">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={phoneQr} alt="QR code that opens this page on your phone" width={104} height={104} className="size-[104px] shrink-0 rounded-xl" />
              <p className="text-sm text-muted"><b className="text-ink">Use your phone instead.</b> Scan, sign in, then tap Add a passkey.</p>
            </div>
          )}
        </div>
      </Sheet>

      <Sheet open={view === "au"} onClose={closeAu} title="Authenticator app">
        <div className="space-y-4">
          {flash}
          {showCodes && totp ? (
            <>
              <p className="text-sm text-muted">Save these backup codes. Each works once if you lose your phone. They won&apos;t be shown again.</p>
              <p className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-4 font-mono text-[15px]">{totp.backup.map((b) => <span key={b}>{b}</span>)}</p>
              <div className="flex gap-2"><button type="button" className="btn btn-quiet flex-1 justify-center" onClick={() => navigator.clipboard.writeText(codesText).then(() => say("ok", "Copied."))}><Copy size={16} aria-hidden /> Copy</button><button type="button" className="btn btn-quiet flex-1 justify-center" onClick={downloadCodes}><Download size={16} aria-hidden /> Download</button></div>
              <button type="button" className="btn w-full justify-center" onClick={closeAu}>I&apos;ve saved them</button>
            </>
          ) : totp && !totpOn ? (
            <>
              <p className="text-sm text-muted">Scan this in your app, then type the code it shows.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={totp.qr} alt="QR code to scan with your authenticator app" width={190} height={190} className="mx-auto rounded-2xl bg-white p-2" />
              <p className="break-all text-center font-mono text-xs text-muted">{totp.secret}</p>
              <div className="flex gap-2"><input aria-label="6-digit code" className="field tracking-[0.3em]" inputMode="numeric" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" placeholder="123456" /><button type="button" onClick={confirmTotp} disabled={busy || code.replace(/\D/g, "").length < 6} className="btn">Turn on</button></div>
            </>
          ) : totpOn ? (
            <>
              <p className="text-sm text-muted">It&apos;s on. To turn it off, confirm your password.</p>
              <div className="flex gap-2"><input id="au-p2" type="password" aria-label="Your password" className="field" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" placeholder="Your password" /><button type="button" onClick={stopTotp} disabled={busy || !pw} className="btn btn-quiet">Turn off</button></div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">Works with 1Password, Google Authenticator and Authy. Confirm your password to start.</p>
              <div className="flex gap-2"><input id="au-p" type="password" aria-label="Your password" className="field" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" placeholder="Your password" /><button type="button" onClick={startTotp} disabled={busy || !pw} className="btn">Continue</button></div>
            </>
          )}
        </div>
      </Sheet>
    </div>
  );
}
