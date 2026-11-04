"use client";
import type { ReactNode } from "react";

/** A search form that applies itself: change a dropdown or tick a box and the list updates. Typing in the search box still waits for Enter. */
export function AutoGetForm({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <form role="search" className={className} onChange={(e) => { const t = e.target as unknown as HTMLInputElement; if (t.tagName === "SELECT" || t.type === "checkbox") e.currentTarget.requestSubmit(); }}>
      {children}
    </form>
  );
}

/** One dropdown that saves the moment it changes (for example a ticket's status). */
export function AutoSelect({ action, name, value, options, label, hidden = {}, className = "" }: { action: (fd: FormData) => void | Promise<void>; name: string; value: string; options: { value: string; label: string }[]; label: string; hidden?: Record<string, string>; className?: string }) {
  return (
    <form action={action} className={className}>
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <label className="sr-only" htmlFor={`as-${name}`}>{label}</label>
      <select id={`as-${name}`} name={name} defaultValue={value} className="field !min-h-10 !w-auto !py-1 font-semibold" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </form>
  );
}
