"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { signAction, declineAction } from "@/app/actions/public";
import { ErrorSummary } from "./ui";

export function SignForm({ token, defaultName, consent, business }: { token: string; defaultName: string; consent: string; business?: string }) {
  const [state, act, pending] = useActionState(signAction, undefined as { error?: string } | undefined);
  const [method, setMethod] = useState<"typed" | "drawn">("drawn");
  const [name, setName] = useState(defaultName);
  const [image, setImage] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    if (method !== "drawn") return;
    const c = canvas.current!; const ctx = c.getContext("2d")!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.clientWidth * ratio; c.height = c.clientHeight * ratio;
    ctx.scale(ratio, ratio); ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.strokeStyle = "#0E1311";
  }, [method]);

  const pos = (e: React.PointerEvent) => { const r = canvas.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  const down = (e: React.PointerEvent) => { drawing.current = true; canvas.current!.setPointerCapture(e.pointerId); const ctx = canvas.current!.getContext("2d")!; const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); };
  const move = (e: React.PointerEvent) => { if (!drawing.current) return; const ctx = canvas.current!.getContext("2d")!; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); dirty.current = true; };
  const up = () => { if (drawing.current) { drawing.current = false; setImage(dirty.current ? canvas.current!.toDataURL("image/png") : ""); } };
  const clear = () => { const c = canvas.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); dirty.current = false; setImage(""); };

  const today = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(new Date());
  return (
    <form action={act} className="sign-panel" aria-labelledby="sign-h">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="method" value={method} />
      <input type="hidden" name="image" value={method === "drawn" ? image : ""} />
      <div className="d-sig !max-w-none">
        <h2 id="sign-h" className="text-xl font-bold">Sign this order</h2>{business && <p className="mb-1 text-sm text-muted">Accepted on behalf of {business}</p>}
        <p className="d-small mb-4">Draw your signature with your finger or mouse, or type your name. Then confirm and submit.</p>
        <ErrorSummary message={state?.error} />
        <div className="d-row">
          <span className="lb" id="sig-l">Signature</span>
          <div className="mb-2 mt-1 flex gap-2" role="radiogroup" aria-label="Signature method">
            {(["drawn", "typed"] as const).map((m) => (
              <button type="button" key={m} role="radio" aria-checked={method === m} onClick={() => setMethod(m)} className={`btn !min-h-10 ${method === m ? "" : "btn-quiet"}`}>{m === "drawn" ? "Draw" : "Type my name"}</button>
            ))}
          </div>
          {method === "typed" ? (
            <div aria-live="polite" aria-labelledby="sig-l" className="ln tall typed break-words">{name || <span className="text-base not-italic text-muted">Your typed name appears here</span>}</div>
          ) : (
            <div>
              <canvas ref={canvas} aria-labelledby="sig-l" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="h-40 w-full rounded-[8px] border border-[#8f9993] bg-white/80" style={{ touchAction: "none" }} />
              <div className="mt-2 flex items-center justify-between"><button type="button" className="btn btn-quiet !min-h-11 sm:!min-h-9" onClick={clear}>Clear</button><span className="d-small">{image ? "Signature captured" : "Sign in the box above"}</span></div>
            </div>
          )}
        </div>
        <div className="d-row"><label className="lb" htmlFor="name">Name</label><input id="name" name="name" className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div className="d-row"><label className="lb" htmlFor="position">Position <span className="normal-case tracking-normal text-muted">(optional)</span></label><input id="position" name="position" className="field" autoComplete="organization-title" placeholder="e.g. Director" /></div>
        <div className="d-row"><span className="lb">Date</span><div className="ln">{today}</div></div>
      </div>
      <label className="mt-6 flex items-start gap-3 text-sm"><input className="mt-1 size-5 shrink-0 accent-[#0c6a49]" type="checkbox" name="consent" required /><span>{consent}</span></label>
      <button className="btn mt-5 w-full sm:w-auto sm:px-10" disabled={pending || (method === "drawn" && !image)}>{pending ? "Signing…" : "Sign and submit"}</button>
    </form>
  );
}

export function DeclineForm({ token }: { token: string }) {
  return (
    <details className="mt-6 border-t border-line pt-3 text-sm">
      <summary className="cursor-pointer min-h-11 flex items-center text-muted">Not ready to sign?</summary>
      <form action={declineAction} className="mt-2 space-y-2 max-w-md">
        <input type="hidden" name="token" value={token} />
        <label className="label" htmlFor="reason">Tell us why (optional)</label>
        <textarea id="reason" name="reason" className="field" />
        <button className="btn btn-quiet">Decline to sign</button>
      </form>
    </details>
  );
}
