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
export function Wizard({ steps, action, review, actions, error, intro, check }: {
  steps: WizardStep[]; action: (fd: FormData) => void; review: (fd: FormData) => ReviewRow[]; actions: ReactNode; error?: ReactNode; intro?: ReactNode;
  /** Runs when the person reaches the final step; whatever it returns (a warning, for example) is shown above the summary. */
  check?: (fd: FormData) => Promise<ReactNode>;
}) {
  const live = steps.filter((s) => !s.skip);
  const all = [...live, { id: "__review", title: "Check", node: null as ReactNode }];
  const [i, setI] = useState(0);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [notice, setNotice] = useState<ReactNode>(null);
  const form = useRef<HTMLFormElement>(null);
  const cur = all[Math.min(i, all.length - 1)];
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
    <form ref={form} action={action} className="wz" onKeyDown={(e) => {
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
    </form>
  );
}
