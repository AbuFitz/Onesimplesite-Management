"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Lock, Send } from "lucide-react";
import { SubmitButton } from "./submit-button";

/** One box for both things you do: reply to the customer, or leave a note only the team sees. The colour changes so you can never mix them up. */
export function TicketComposer({ action, id, to, children }: { action: (fd: FormData) => void | Promise<void>; id: string; to: string; children: ReactNode }) {
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = ta.current; if (!el) return; const fit = () => { el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 320)}px`; }; fit(); el.addEventListener("input", fit); return () => el.removeEventListener("input", fit); }, []);
  return (
    <form action={action} className={`tkc ${mode}`}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="mode" value={mode} />
      <div className="tkc-tabs" role="tablist" aria-label="What to do">
        <button type="button" role="tab" aria-selected={mode === "reply"} onClick={() => setMode("reply")}><Send size={14} aria-hidden /> Reply</button>
        <button type="button" role="tab" aria-selected={mode === "note"} onClick={() => setMode("note")}><Lock size={14} aria-hidden /> Private note</button>
      </div>
      <label className="sr-only" htmlFor="tk-body">Message</label>
      <textarea ref={ta} id="tk-body" name="body" rows={3} required className="tkc-ta" placeholder={mode === "reply" ? `Write to ${to}…` : "Only your team will see this…"} />
      {children}
      <div className="tkc-foot">
        <p>{mode === "reply" ? "Sent from your own address and shown in their portal." : "Never shown to the customer."}</p>
        <SubmitButton className="btn" pendingText={mode === "reply" ? "Sending…" : "Saving…"}>{mode === "reply" ? "Send" : "Save note"}</SubmitButton>
      </div>
    </form>
  );
}
