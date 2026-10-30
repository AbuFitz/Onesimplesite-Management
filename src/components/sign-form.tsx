"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { signAction, declineAction } from "@/app/actions/public";
import { ErrorSummary } from "./ui";

export function SignForm({ token, defaultName, consent }: { token: string; defaultName: string; consent: string }) {
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

  return (
    <form action={act} className="mt-10 space-y-5 border-t border-line pt-6">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="method" value={method} />
      <input type="hidden" name="image" value={method === "drawn" ? image : ""} />
      <h2>Sign this agreement</h2>
      <ErrorSummary message={state?.error} />
      <div>
        <label className="label" htmlFor="name">Your full name</label>
        <input id="name" name="name" className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <fieldset>
        <legend className="label">Signature</legend>
        <div className="flex gap-2 mb-3" role="radiogroup" aria-label="Signature method">
          {(["drawn", "typed"] as const).map((m) => (
            <button type="button" key={m} role="radio" aria-checked={method === m} onClick={() => setMethod(m)} className={`btn ${method === m ? "" : "btn-quiet"}`}>{m === "drawn" ? "Draw" : "Type my name"}</button>
          ))}
        </div>
        {method === "typed" ? (
          <p aria-live="polite" className="border-b border-ink min-h-16 flex items-end pb-1 text-3xl italic break-words" style={{ fontFamily: "'Snell Roundhand','Segoe Script','Brush Script MT',cursive" }}>{name || <span className="text-muted text-base not-italic">Your typed name appears here</span>}</p>
        ) : (
          <div>
            <canvas ref={canvas} aria-label="Signature drawing area" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="w-full h-40 bg-white border border-ink rounded-[8px]" style={{ touchAction: "none" }} />
            <button type="button" className="btn btn-quiet mt-2" onClick={clear}>Clear</button>
          </div>
        )}
      </fieldset>
      <label className="flex items-start gap-3 text-sm"><input className="mt-1 size-5 shrink-0" type="checkbox" name="consent" required /><span>{consent}</span></label>
      <button className="btn w-full sm:w-auto" disabled={pending || (method === "drawn" && !image)}>{pending ? "Signing…" : "Sign and submit"}</button>
    </form>
  );
}

export function DeclineForm({ token }: { token: string }) {
  return (
    <details className="mt-8 text-sm">
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
