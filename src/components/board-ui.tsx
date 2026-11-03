"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { Lock, Users } from "lucide-react";
import { postAction, commentAction } from "@/app/actions/board";
import { Avatar, ErrorSummary } from "./ui";

/** Collapsed to one line until you click it, like posting on a social feed. */
export function Composer({ name }: { name: string }) {
  const [s, act, pending] = useActionState(postAction, undefined as { error?: string; done?: boolean } | undefined);
  const [open, setOpen] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (s?.done) { form.current?.reset(); setOpen(false); } }, [s]);
  return (
    <form ref={form} action={act} className="mb-6 rounded-2xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(14,19,17,.04)]">
      <div className="flex items-start gap-3">
        <Avatar name={name} />
        <div className="min-w-0 flex-1">
          {!open ? (
            <button type="button" onClick={() => setOpen(true)} className="flex min-h-10 w-full items-center rounded-lg bg-soft px-4 text-left text-[15px] text-muted hover:bg-[#e8ece9]">Post something to the team…</button>
          ) : (
            <div className="space-y-3">
              <ErrorSummary message={s?.error} />
              <label className="sr-only" htmlFor="bp-title">Title (optional)</label>
              <input id="bp-title" name="title" className="field" placeholder="Title (optional)" autoComplete="off" />
              <label className="sr-only" htmlFor="bp-body">What do you want to share?</label>
              <textarea id="bp-body" name="body" rows={5} autoFocus required className="field" placeholder={"An update, a win, a question, a how-to…\n\nUse - for lists and # for headings."} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-muted"><span>Who can see it</span>
                  <select name="visibility" className="field !min-h-9 w-auto !py-1 !text-sm" defaultValue="team"><option value="team">The whole team</option><option value="private">Only me</option></select></label>
                <div className="flex gap-2"><button type="button" className="btn btn-quiet" onClick={() => setOpen(false)}>Cancel</button><button className="btn" disabled={pending}>{pending ? "Posting…" : "Post"}</button></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}

export function CommentForm({ id, name }: { id: string; name: string }) {
  const [s, act, pending] = useActionState(commentAction, undefined as { error?: string; done?: boolean } | undefined);
  const form = useRef<HTMLFormElement>(null);
  const [text, setText] = useState("");
  useEffect(() => { if (s?.done) { form.current?.reset(); setText(""); } }, [s]);
  return (
    <form ref={form} action={act} className="flex items-start gap-3">
      <input type="hidden" name="id" value={id} />
      <Avatar name={name} size={32} />
      <div className="min-w-0 flex-1 space-y-2">
        <ErrorSummary message={s?.error} />
        <label className="sr-only" htmlFor="cm-body">Write a comment</label>
        <textarea id="cm-body" name="body" rows={2} className="field" placeholder="Write a comment…" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn" disabled={pending || !text.trim()}>{pending ? "Posting…" : "Comment"}</button>
      </div>
    </form>
  );
}

export const VisBadge = ({ v }: { v: string }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-soft px-2 py-0.5 text-xs text-muted">{v === "private" ? <Lock size={11} aria-hidden /> : <Users size={11} aria-hidden />}{v === "private" ? "Only me" : "Team"}</span>
);
