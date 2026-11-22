"use client";
import { useTransition, type ReactNode, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";

/** A search form that applies itself: change a dropdown or tick a box and the list updates. Typing in the search box still waits for Enter. */
export function AutoGetForm({ children, className }: { children: ReactNode; className?: string }) {
  const router = useRouter(), path = usePathname();
  const [pending, start] = useTransition();
  // A filter used to submit like a plain web form: the whole page reloaded and any open panel closed. Now it just updates the address and the list, in place.
  const go = (e: FormEvent<HTMLFormElement>) => {
    if (e.target !== e.currentTarget) return; // a form inside a popup that sits under this one (React bubbles submits out of portals)
    e.preventDefault();
    const fd = new FormData(e.currentTarget), p = new URLSearchParams();
    for (const [k, v] of fd.entries()) if (typeof v === "string" && v !== "") p.set(k, v);
    const qs = p.toString();
    start(() => router.replace(qs ? `${path}?${qs}` : path, { scroll: false }));
  };
  return (
    <form role="search" className={className} data-pending={pending || undefined} onSubmit={go} onChange={(e) => { if (e.target instanceof HTMLElement && e.target.closest("[role=dialog]")) return; const t = e.target as unknown as HTMLInputElement; if (t.tagName === "SELECT" || t.type === "checkbox") e.currentTarget.requestSubmit(); }}>
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
