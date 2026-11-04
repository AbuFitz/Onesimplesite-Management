"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { quickEventAction, updateEventAction } from "@/app/actions/work";
import { SubmitButton } from "./submit-button";

const TYPES = [["internal_meeting", "Team meeting"], ["client_call", "Customer call"], ["review", "Review"], ["focus", "Focus time"], ["other", "Something else"]] as const;

/** Add an event: a bottom sheet on a phone, a centred box on a computer. Opened by a link (?add=1), so it works everywhere and survives a refresh. */
export type EditEvent = { id: string; version: number; title: string; type: string; date: string; time: string; minutes: number; allDay: boolean; location: string; customerId: string };
export function AddEventDialog({ open, closeHref, day, view, scope, companies, error, edit }: { open: boolean; closeHref: string; day: string; view: string; scope: string; companies: { id: string; name: string }[]; error?: string; edit?: EditEvent }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  const close = () => router.replace(closeHref);
  return (
    <dialog ref={ref} aria-label="Add an event" onCancel={(e) => { e.preventDefault(); close(); }} onClick={(e) => { if (e.target === ref.current) close(); }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-3xl bg-white p-0 backdrop:bg-[rgba(9,9,11,.45)] sm:m-auto sm:w-[30rem] sm:rounded-2xl sm:shadow-[0_24px_70px_rgba(9,9,11,.3)]">
      {open && (
        <form key={edit?.id ?? "new"} action={edit ? updateEventAction : quickEventAction} className="flex max-h-[92dvh] flex-col">
          {edit && <><input type="hidden" name="id" value={edit.id} /><input type="hidden" name="version" value={edit.version} /></>}
          <input type="hidden" name="view" value={view} /><input type="hidden" name="scope" value={scope} />
          <header className="flex items-center justify-between border-b border-line px-5 py-4"><h2 className="text-lg font-bold">{edit ? "Edit event" : "Add an event"}</h2><button type="button" onClick={close} aria-label="Close" className="grid size-10 place-items-center rounded-lg hover:bg-soft"><X size={18} aria-hidden /></button></header>
          <div className="space-y-4 overflow-y-auto px-5 py-4">
            {error && <p role="alert" className="rounded-lg bg-[#fdecea] px-3 py-2 text-sm font-semibold text-[#a12a1f]">{error}</p>}
            <div><label className="label" htmlFor="ev-t">What is it?</label><input id="ev-t" name="title" className="field !min-h-12 !text-base" placeholder="e.g. Call with Alex" required autoFocus autoComplete="off" defaultValue={edit?.title} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="ev-d">Day</label><input id="ev-d" name="date" type="date" className="field !min-h-12" defaultValue={edit?.date ?? day} required /></div>
              <div><label className="label" htmlFor="ev-s">Starts</label><input id="ev-s" name="time" type="time" className="field !min-h-12" defaultValue={edit?.time ?? "09:00"} step={900} /></div>
              <div><label className="label" htmlFor="ev-l">Length</label><select id="ev-l" name="minutes" className="field !min-h-12" defaultValue={String(edit?.minutes ?? 60)}>{[...(edit && ![15, 30, 45, 60, 90, 120, 240].includes(edit.minutes) ? [[edit.minutes, `${edit.minutes} min`]] : []), [15, "15 min"], [30, "30 min"], [45, "45 min"], [60, "1 hour"], [90, "1.5 hours"], [120, "2 hours"], [240, "Half a day"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <label className="flex min-h-12 items-center gap-2 self-end text-sm font-semibold"><input type="checkbox" name="allDay" className="size-5" defaultChecked={edit?.allDay} /> All day</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="ev-y">Kind</label><select id="ev-y" name="type" className="field !min-h-12" defaultValue={edit?.type ?? "internal_meeting"}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <div><label className="label" htmlFor="ev-b">Company <span className="font-normal text-muted">(optional)</span></label><select id="ev-b" name="customerId" className="field !min-h-12" defaultValue={edit?.customerId ?? ""}><option value="">None</option>{companies.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            </div>
            <div><label className="label" htmlFor="ev-w">Where, or a meeting link <span className="font-normal text-muted">(optional)</span></label><input id="ev-w" name="location" className="field !min-h-12" autoComplete="off" defaultValue={edit?.location} /></div>
          </div>
          <footer className="flex gap-2 border-t border-line px-5 py-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}><button type="button" onClick={close} className="btn btn-quiet !min-h-12 flex-1 sm:flex-none">Cancel</button><SubmitButton className="btn !min-h-12 flex-1 sm:flex-none sm:px-8" pendingText={edit ? "Saving…" : "Adding…"}>{edit ? "Save changes" : "Add event"}</SubmitButton></footer>
        </form>
      )}
    </dialog>
  );
}
