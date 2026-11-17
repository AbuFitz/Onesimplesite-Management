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
  useEffect(() => { if (s?.done) ref.current?.reset(); }, [s]);
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
        <textarea ref={box} id="rp-body" name="body" rows={1} required placeholder="Write a reply…" className="cmp-input" onInput={grow} />
        <button className="cmp-send" disabled={pending} aria-label={pending ? "Sending" : "Send reply"}><ArrowUp size={20} aria-hidden /></button>
      </div>
      <FilePicker />
    </form>
  );
}
