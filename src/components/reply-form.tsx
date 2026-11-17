"use client";
import { useActionState, useRef, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { replyAction } from "@/app/actions/portal";
import { ErrorSummary } from "./ui";
import { FilePicker } from "./file-picker";

const QUICK = ["Thanks, that works", "Can you call me?", "I've sent the files"];

/** The reply composer: a rounded glass box that grows as you type, a round send button, and one-tap quick replies. */
export function ReplyForm({ id }: { id: string }) {
  const [s, act, pending] = useActionState(replyAction, undefined as { error?: string; done?: boolean } | undefined);
  const ref = useRef<HTMLFormElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const draftKey = `oss-reply-draft-${id}`;
  // Your half-written reply survives a refresh, a lost signal or switching apps; it is cleared once sent.
  useEffect(() => { try { const d = localStorage.getItem(draftKey); if (d && box.current && !box.current.value) { box.current.value = d; grow(); } } catch { /* private window */ } }, [draftKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (s?.done) { ref.current?.reset(); try { localStorage.removeItem(draftKey); } catch { /* ignore */ } if (box.current) box.current.style.height = "auto"; } }, [s, draftKey]);
  const grow = () => { const t = box.current; if (t) { t.style.height = "auto"; t.style.height = `${Math.min(t.scrollHeight, 160)}px`; } };
  return (
    <form ref={ref} action={act} className="composer">
      <ErrorSummary message={s?.error} />
      <input type="hidden" name="id" value={id} />
      <div className="cmp-chips" role="group" aria-label="Quick replies">
        {QUICK.map((q) => <button key={q} type="button" className="cmp-chip" onClick={() => { if (box.current) { box.current.value = q; box.current.focus(); grow(); } }}>{q}</button>)}
      </div>
      <div className="cmp-box">
        <label className="sr-only" htmlFor="rp-body">Reply</label>
        <textarea ref={box} id="rp-body" name="body" rows={1} required placeholder="Write a reply…" className="cmp-input" onInput={() => { grow(); try { const v = box.current?.value ?? ""; if (v) localStorage.setItem(draftKey, v); else localStorage.removeItem(draftKey); } catch { /* ignore */ } }} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ref.current?.requestSubmit(); } }} enterKeyHint="send" />
        <button className="cmp-send" disabled={pending} aria-label={pending ? "Sending" : "Send reply"}><ArrowUp size={20} aria-hidden /></button>
      </div>
      <FilePicker />
    </form>
  );
}
