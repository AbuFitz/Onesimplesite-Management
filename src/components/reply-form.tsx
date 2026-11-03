"use client";
import { useActionState, useRef, useEffect } from "react";
import { replyAction } from "@/app/actions/portal";
import { ErrorSummary } from "./ui";

export function ReplyForm({ id }: { id: string }) {
  const [s, act, pending] = useActionState(replyAction, undefined as { error?: string; done?: boolean } | undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (s?.done) ref.current?.reset(); }, [s]);
  return (
    <form ref={ref} action={act} className="space-y-3">
      <ErrorSummary message={s?.error} />
      <input type="hidden" name="id" value={id} />
      <label className="label" htmlFor="rp-body">Reply</label>
      <textarea id="rp-body" name="body" rows={4} className="field" required />
      <button className="btn btn-dark" disabled={pending}>{pending ? "Sending…" : "Send reply"}</button>
    </form>
  );
}
