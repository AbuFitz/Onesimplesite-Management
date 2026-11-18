"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Pencil } from "lucide-react";

export type WizardStep = { id: string; title: string; hint?: string; node: ReactNode; skip?: boolean; ready?: boolean };
export type ReviewRow = { label: string; value: string; step: string };

/**
 * A step-by-step flow (the pattern the signing and onboarding tools use): one thing per screen, named steps with progress,
 * Back and Continue always in reach, each step checked before you move on, a final "check it" step that lists what you entered
 * with a way back to change any of it, and one submit at the end. Every step stays in the page (just hidden), so nothing is lost
 * going back and forth, and the server gets one complete form.
 */
type Vals = Record<string, string | string[]>;
const TTL = 7 * 864e5;
const ago = (t: number) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", ...(Date.now() - t > 864e5 ? { day: "numeric", month: "short" } : {}) }).format(t); };

export function Wizard({ steps, action, review, actions, error, errorMessage, intro, check, draftKey, onRestore, later }: {
  steps: WizardStep[]; action: (fd: FormData) => void; review: (fd: FormData) => ReviewRow[]; actions: ReactNode; error?: ReactNode; intro?: ReactNode;
  /** Saves what has been typed (on this device) so a refresh, a lost signal or a closed tab loses nothing, and picks it up again next time. */
  draftKey?: string;
  /** Needed only when a form keeps part of its answers in its own state (cards you tap): receives the saved values so it can set that state. */
  onRestore?: (v: Vals) => void;
  /** An explicit "finish later" way out. The draft is already saved; this just leaves. */
  later?: { href: string; label?: string };
  /** The server's complaint, if any: the form is put back as it was so nothing has to be typed again. */
  errorMessage?: string;
  /** Runs when the person reaches the final step; whatever it returns (a warning, for example) is shown above the summary. */
  check?: (fd: FormData) => Promise<ReactNode>;
}) {
  const live = steps.filter((s) => !s.skip);
  const all = [...live, { id: "__review", title: "Check", node: null as ReactNode }];
  const [i, setI] = useState(0);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [notice, setNotice] = useState<ReactNode>(null);
  const form = useRef<HTMLFormElement>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [resumed, setResumed] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitted = useRef(false);
  const key = draftKey ? `oss-draft:${draftKey}` : null;
  const cur = all[Math.min(i, all.length - 1)];
  const curId = cur.id;

  const collect = (): Vals & { __typed?: string } => {
    const f = form.current, out: Vals & { __typed?: string } = {}; if (!f) return out;
    let typed = false;
    for (const el of Array.from(f.elements) as HTMLInputElement[]) {
      if (!el.name || el.name.startsWith("$") || el.disabled || ["file", "password", "submit", "button", "reset"].includes(el.type)) continue;
      if (["text", "email", "tel", "url", "search", "number", "textarea", "select-one"].includes(el.type) && el.type !== "select-one" && el.value.trim()) typed = true;
      if (el.type === "radio") { if (el.checked) out[el.name] = el.value; }
      else if (el.type === "checkbox") out[el.name] = el.checked ? "on" : "";
      else out[el.name] = el.value;
    }
    if (typed) out.__typed = "1";
    return out;
  };
  const save = () => {
    if (!key || submitted.current) return;
    const { __typed, ...v } = collect();
    const had = (() => { try { return !!localStorage.getItem(key); } catch { return false; } })();
    if (!__typed && !had) return;   // nothing typed yet and nothing saved: no draft
    if (!__typed && had) return;    // a fresh empty form must never overwrite a saved draft
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), step: curId, v })); setSaved(Date.now()); } catch { /* private window or full: just no draft */ }
  };
  const later1 = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(save, 450); };
  const apply = (v: Vals) => {
    const f = form.current; if (!f) return;
    for (const [name, val] of Object.entries(v)) {
      try {
      const node = f.elements.namedItem(name); if (!node) continue;
      const list = (node instanceof RadioNodeList ? Array.from(node) : [node]) as HTMLInputElement[];
      for (const el of list) {
        if (!el || ["file", "password", "hidden", "submit", "button"].includes(el.type)) continue;
        if (el.type === "radio") { if (el.value === val && !el.checked) el.click(); }
        else if (el.type === "checkbox") { if (el.checked !== (val === "on")) el.click(); }
        else if (el.value !== val) {
          const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, val as string);
          el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      } catch { /* one odd field must not stop the rest being put back */ }
    }
  };
  const restore = (stepToo: boolean) => {
    if (!key) return false;
    try {
      const d = JSON.parse(localStorage.getItem(key) ?? "null") as { at: number; step: string; v: Vals } | null;
      if (!d || Date.now() - d.at > TTL) { localStorage.removeItem(key); return false; }
      onRestore?.(d.v);
      window.setTimeout(() => { apply(d.v); if (stepToo) { const n = all.findIndex((x) => x.id === d.step); if (n > 0 && n < all.length - 1) setI(n); } }, 60);
      setResumed(d.at); setSaved(d.at); return true;
    } catch { return false; }
  };
  const discard = () => { if (key) { try { localStorage.removeItem(key); } catch { /* ignore */ } } window.location.reload(); };
  // Open with the draft back in place; leave it behind once the form has been sent.
  useEffect(() => { restore(true); return () => { if (key && submitted.current) { try { localStorage.removeItem(key); } catch { /* ignore */ } } }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (errorMessage && key) window.setTimeout(() => restore(false), 120); }, [errorMessage]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { save(); }, [curId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const h = () => save(); window.addEventListener("pagehide", h); document.addEventListener("visibilitychange", h); return () => { window.removeEventListener("pagehide", h); document.removeEventListener("visibilitychange", h); }; }); // eslint-disable-line react-hooks/exhaustive-deps
  const last = cur.id === "__review";

  const go = (n: number) => {
    const f = form.current; if (!f) return;
    if (all[n]?.id === "__review") { const fd = new FormData(f); setRows(review(fd)); setNotice(null); check?.(fd).then(setNotice).catch(() => {}); }
    setI(n);
  };
  const valid = () => {
    const sec = form.current?.querySelector<HTMLElement>(`[data-step="${cur.id}"]`); if (!sec) return true;
    return [...sec.querySelectorAll<HTMLInputElement>("input,select,textarea")].every((el) => el.disabled || el.type === "hidden" || el.reportValidity());
  };
  const next = () => { if (valid()) go(Math.min(all.length - 1, i + 1)); };
  const jump = (id: string) => { const n = all.findIndex((s) => s.id === id); if (n >= 0) setI(n); };

  // New screen: back to the top, and into the first field so the keyboard (on a phone) is already where you type.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    const sec = form.current?.querySelector<HTMLElement>(`[data-step="${cur.id}"]`);
    const el = sec?.querySelector<HTMLElement>("input:not([type=hidden]):not([type=radio]):not([type=checkbox]),textarea");
    if (el && window.matchMedia("(pointer: fine)").matches) el.focus({ preventScroll: true });
  }, [cur.id]);

  return (
    <form ref={form} action={action} className="wz" onInput={later1} onChange={later1} onSubmit={() => { submitted.current = true; }} onKeyDown={(e) => {
      const t = e.target as HTMLElement;
      if (e.key === "Enter" && t.tagName === "INPUT" && !last) { e.preventDefault(); next(); }
    }}>
      <nav className="wz-bar" aria-label="Progress">
        <p className="wz-now"><b>{cur.title}</b><span>Step {Math.min(i + 1, all.length)} of {all.length}</span></p>
        <ol>
          {all.map((s, n) => (
            <li key={s.id} className={n < i ? "done" : n === i ? "on" : ""}>
              <button type="button" disabled={n >= i} onClick={() => setI(n)} aria-current={n === i ? "step" : undefined} aria-label={`${s.title}${n < i ? ", done. Go back to it" : ""}`}>
                <i aria-hidden>{n < i ? <Check size={12} /> : n + 1}</i><span>{s.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
      {resumed && (
        <p className="wz-resume" role="status">Picked up where you left off ({ago(resumed)}). <button type="button" onClick={discard}>Start again</button></p>
      )}
      {error}
      {intro}
      {live.map((s) => (
        <section key={s.id} data-step={s.id} hidden={cur.id !== s.id} className="wz-step" aria-label={s.title}>
          {s.hint && <p className="wz-hint">{s.hint}</p>}
          {s.node}
        </section>
      ))}
      <section data-step="__review" hidden={!last} className="wz-step" aria-label="Check">
        {notice}
        <p className="wz-hint">Have a last look. You can change anything.</p>
        <dl className="wz-review">
          {rows.filter((r) => r.value.trim()).map((r) => (
            <div key={r.label + r.step}><dt>{r.label}</dt><dd>{r.value}</dd><button type="button" onClick={() => jump(r.step)} aria-label={`Change ${r.label}`}><Pencil size={14} aria-hidden /></button></div>
          ))}
        </dl>
      </section>
      <div className={`wz-foot ${last ? "last" : ""}`}>
        {i > 0 && <button type="button" className="wz-back" onClick={() => setI(i - 1)}><ArrowLeft size={17} aria-hidden /> Back</button>}
        {last ? <div className="wz-submit">{actions}</div> : <button type="button" className="wz-next" onClick={next} disabled={cur.ready === false}>Continue <ArrowRight size={17} aria-hidden /></button>}
      </div>
      {(key || later) && (
        <p className="wz-meta">
          {key && saved && <span className="wz-saved"><Check size={13} aria-hidden /> Draft saved on this device</span>}
          {later && <a href={later.href}>{later.label ?? "Finish later"}</a>}
        </p>
      )}
    </form>
  );
}
