"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

type Ask = { message: string; title?: string; confirmLabel?: string; resolve: (ok: boolean) => void };

/** The "are you sure?" popup, replacing the browser's own. Call ask(message) and await true or false; render `node` once in your component. */
export function useConfirm() {
  const [req, setReq] = useState<Ask | null>(null);
  const ask = (message: string, o: { title?: string; confirmLabel?: string } = {}) => new Promise<boolean>((resolve) => setReq({ message, ...o, resolve }));
  const done = (ok: boolean) => { req?.resolve(ok); setReq(null); };
  return { ask, node: req ? <ConfirmDialog req={req} done={done} /> : null };
}

function ConfirmDialog({ req, done }: { req: Ask; done: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  return (
    <dialog ref={ref} className="rec-dlg cfm-dlg" aria-labelledby="cfm-t" aria-describedby="cfm-m" onCancel={(e) => { e.preventDefault(); done(false); }} onClick={(e) => { if (e.target === ref.current) done(false); }}>
      <div className="cfm">
        <span className="cfm-ico" aria-hidden><AlertTriangle size={22} /></span>
        <h2 id="cfm-t">{req.title ?? "Are you sure?"}</h2>
        <p id="cfm-m">{req.message}</p>
        <div className="cfm-act">
          <button type="button" className="cfm-no" autoFocus onClick={() => done(false)}>Cancel</button>
          <button type="button" className="cfm-yes" onClick={() => done(true)}>{req.confirmLabel ?? "Yes, continue"}</button>
        </div>
      </div>
    </dialog>
  );
}

/** A form that asks "are you sure?" before it submits. For deletes. */
export function ConfirmForm({ action, message, children, className, confirmLabel = "Delete" }: { action: (fd: FormData) => void | Promise<void>; message: string; children: ReactNode; className?: string; confirmLabel?: string }) {
  const { ask, node } = useConfirm();
  const ok = useRef(false);
  return (
    <>
      <form action={action} className={className} onSubmit={async (e) => {
        if (ok.current) { ok.current = false; return; }
        e.preventDefault();
        const form = e.currentTarget;
        if (await ask(message, { confirmLabel })) { ok.current = true; form.requestSubmit(); }
      }}>{children}</form>
      {node}
    </>
  );
}
