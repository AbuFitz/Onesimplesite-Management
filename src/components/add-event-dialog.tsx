"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, CalendarDays, Clock, Sun, Building2, MapPin } from "lucide-react";
import { quickEventAction, updateEventAction } from "@/app/actions/work";
import { SubmitButton } from "./submit-button";

const TYPES = [["internal_meeting", "Team meeting"], ["client_call", "Customer call"], ["review", "Review"], ["focus", "Focus time"], ["other", "Something else"]] as const;

/** Add an event: a bottom sheet on a phone, a centred box on a computer. Opened by a link (?add=1), so it works everywhere and survives a refresh. */
export type EditEvent = { id: string; version: number; title: string; type: string; date: string; time: string; minutes: number; allDay: boolean; location: string; customerId: string };
const LENGTHS = [[15, "15 min"], [30, "30 min"], [45, "45 min"], [60, "1 hour"], [90, "1.5 hours"], [120, "2 hours"], [240, "Half a day"]] as const;
const pad = (n: number) => String(n).padStart(2, "0");
/** "Tue 17 Nov, 09:00 to 10:00" from the form's own values, so the person sees what they are about to save. */
function summarise(f: FormData) {
  const date = String(f.get("date") ?? ""), time = String(f.get("time") ?? ""), mins = Number(f.get("minutes") ?? 60), all = f.get("allDay") === "on";
  const d = new Date(`${date}T${all ? "00:00" : time || "09:00"}`); if (!date || isNaN(+d)) return "Pick a day";
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(d);
  if (all) return `${day}, all day`;
  const e = new Date(+d + mins * 60000);
  return `${day}, ${pad(d.getHours())}:${pad(d.getMinutes())} to ${pad(e.getHours())}:${pad(e.getMinutes())}`;
}

export function AddEventDialog({ open, closeHref, day, view, scope, companies, error, edit }: { open: boolean; closeHref: string; day: string; view: string; scope: string; companies: { id: string; name: string }[]; error?: string; edit?: EditEvent }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [sum, setSum] = useState(edit ? "" : "");
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  const close = () => router.replace(closeHref);
  const lengths: readonly (readonly [number, string])[] = edit && !LENGTHS.some(([v]) => v === edit.minutes) ? [[edit.minutes, `${edit.minutes} min`], ...LENGTHS] : LENGTHS;
  return (
    <dialog ref={ref} aria-label={edit ? "Edit event" : "Add an event"} onCancel={(e) => { e.preventDefault(); close(); }} onClick={(e) => { if (e.target === ref.current) close(); }}
      className="rec-dlg fl-dlg">
      {open && (
        <form key={edit?.id ?? "new"} action={edit ? updateEventAction : quickEventAction} className="evf" ref={(f) => { if (f && !sum) setSum(summarise(new FormData(f))); }} onChange={(e) => setSum(summarise(new FormData(e.currentTarget)))}>
          {edit && <><input type="hidden" name="id" value={edit.id} /><input type="hidden" name="version" value={edit.version} /></>}
          <input type="hidden" name="view" value={view} /><input type="hidden" name="scope" value={scope} />
          <header className="evf-head">
            <div><h2>{edit ? "Edit event" : "New event"}</h2><p aria-live="polite">{sum}</p></div>
            <button type="button" onClick={close} aria-label="Close" className="iconbtn"><X size={18} aria-hidden /></button>
          </header>
          <div className="evf-body">
            {error && <p role="alert" className="evf-err">{error}</p>}
            <label className="sr-only" htmlFor="ev-t">What is it?</label>
            <input id="ev-t" name="title" className="evf-title" placeholder="What is it?" required autoFocus autoComplete="off" defaultValue={edit?.title} />

            <div className="grp">
              <label className="grp-row" htmlFor="ev-d"><CalendarDays size={18} aria-hidden /><span>Day</span><input id="ev-d" name="date" type="date" defaultValue={edit?.date ?? day} required /></label>
              <label className="grp-row" htmlFor="ev-s"><Clock size={18} aria-hidden /><span>Starts</span><input id="ev-s" name="time" type="time" defaultValue={edit?.time ?? "09:00"} step={900} /></label>
              <label className="grp-row" htmlFor="ev-a"><Sun size={18} aria-hidden /><span>All day</span><span className="sw"><input id="ev-a" type="checkbox" name="allDay" defaultChecked={edit?.allDay} /><i aria-hidden /></span></label>
            </div>

            <fieldset className="evf-set"><legend>How long</legend>
              <div className="rchips scroll">{lengths.map(([v, l]) => (
                <label key={v} className="rchip"><input type="radio" name="minutes" value={v} defaultChecked={v === (edit?.minutes ?? 60)} /><span>{l}</span></label>
              ))}</div>
            </fieldset>

            <fieldset className="evf-set"><legend>Kind</legend>
              <div className="rchips scroll">{TYPES.map(([v, l]) => <label key={v} className="rchip"><input type="radio" name="type" value={v} defaultChecked={v === (edit?.type ?? "internal_meeting")} /><span>{l}</span></label>)}</div>
            </fieldset>

            <div className="grp">
              <label className="grp-row" htmlFor="ev-b"><Building2 size={18} aria-hidden /><span>Company</span>
                <select id="ev-b" name="customerId" defaultValue={edit?.customerId ?? ""}><option value="">None</option>{companies.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
              <label className="grp-row" htmlFor="ev-w"><MapPin size={18} aria-hidden /><span>Where</span><input id="ev-w" name="location" placeholder="Place or meeting link" autoComplete="off" defaultValue={edit?.location} /></label>
            </div>
          </div>
          <footer className="evf-foot"><button type="button" onClick={close} className="evf-cancel">Cancel</button><SubmitButton className="evf-save" pendingText={edit ? "Saving…" : "Adding…"}>{edit ? "Save changes" : "Add event"}</SubmitButton></footer>
        </form>
      )}
    </dialog>
  );
}
