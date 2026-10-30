"use client";
import { Suspense, useActionState, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { createJobAction } from "@/app/actions/job";
import { CATEGORIES, REACH, WORK_TYPES, EXTRAS, SIZES, DOMAINS, CONTENT, TIMING, PAYMENT_PLANS, PRIORITIES, SOURCES } from "@/modules/sales/job-options";
import { ErrorSummary } from "./ui";

const STEPS = ["Customer", "Business", "The job", "Details", "Priority and price"] as const;

function Chip({ type, name, value, label, defaultChecked, hint }: { type: "radio" | "checkbox"; name: string; value: string; label: string; defaultChecked?: boolean; hint?: string }) {
  return (
    <label className="block cursor-pointer">
      <input type={type} name={name} value={value} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="flex min-h-11 flex-col justify-center rounded-xl border border-line px-4 py-2 text-[15px] transition-colors peer-checked:border-moss peer-checked:bg-[#eef7f2] peer-checked:text-moss peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ink">
        <span className="font-medium">{label}</span>{hint && <span className="text-sm font-normal text-muted">{hint}</span>}
      </span>
    </label>
  );
}
const Group = ({ title, children, cols }: { title: string; children: React.ReactNode; cols?: boolean }) => (
  <fieldset><legend className="label mb-2">{title}</legend><div className={cols ? "grid grid-cols-2 gap-2" : "space-y-2"}>{children}</div></fieldset>
);

type Person = { id: string; name: string };
function Wizard({ customers, team, presetCustomer, close }: { customers: Person[]; team: Person[]; presetCustomer?: string; close: () => void }) {
  const [s, act, pending] = useActionState(createJobAction, undefined as { error?: string } | undefined);
  const [step, setStep] = useState(presetCustomer ? 1 : 0);
  const [who, setWho] = useState<"new" | "existing">(presetCustomer ? "existing" : "new");
  const body = useRef<HTMLDivElement>(null);

  function go(n: number) { setStep(n); body.current?.scrollTo({ top: 0 }); }
  function next() {
    const els = body.current?.querySelectorAll<HTMLInputElement>(`[data-step="${step}"] :is(input,select,textarea):not([disabled])`);
    for (const el of Array.from(els ?? [])) if (!el.reportValidity()) return;
    go(step + 1);
  }
  const last = step === STEPS.length - 1;
  const hide = (n: number) => (step === n ? "space-y-5" : "hidden");

  return (
    <form action={act} className="flex h-full flex-col">
      <input type="hidden" name="who" value={who} />
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
        <div><h2 className="text-base">New job ticket</h2><p className="text-sm text-muted">Step {step + 1} of {STEPS.length} · {STEPS[step]}</p></div>
        <button type="button" onClick={close} aria-label="Close" className="btn btn-quiet h-10 w-10 !p-0"><X size={18} /></button>
      </header>
      <div className="flex gap-1 px-5 pt-3" aria-hidden>{STEPS.map((_, i) => <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-moss" : "bg-line"}`} />)}</div>

      <div ref={body} className="flex-1 overflow-y-auto px-5 py-5">
        <ErrorSummary message={s?.error} />

        <div data-step="0" className={hide(0)}>
          <h3 className="text-xl font-semibold">Customer and contact</h3>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="New or existing customer">
            <button type="button" aria-pressed={who === "new"} onClick={() => setWho("new")} className={`btn ${who === "new" ? "" : "btn-quiet"}`}>New customer</button>
            <button type="button" aria-pressed={who === "existing"} onClick={() => setWho("existing")} className={`btn ${who === "existing" ? "" : "btn-quiet"}`}>Existing</button>
          </div>
          {who === "new" ? (
            <>
              <div><label className="label" htmlFor="j-biz">Business name</label><input id="j-biz" name="displayName" className="field" autoComplete="off" required /></div>
              <div><label className="label" htmlFor="j-contact">Contact's name</label><input id="j-contact" name="contactName" className="field" autoComplete="off" required /></div>
              <div><label className="label" htmlFor="j-email">Email</label><input id="j-email" name="email" type="email" inputMode="email" autoCapitalize="none" className="field" /></div>
              <div><label className="label" htmlFor="j-phone">Phone</label><input id="j-phone" name="phone" type="tel" inputMode="tel" className="field" /></div>
              <div><label className="label" htmlFor="j-source">How did they get in touch?</label>
                <select id="j-source" name="source" className="field" defaultValue=""><option value="">Not sure</option>{SOURCES.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
            </>
          ) : (
            <div><label className="label" htmlFor="j-cust">Customer</label>
              <select id="j-cust" name="customerId" className="field" defaultValue={presetCustomer ?? ""} required>
                <option value="" disabled>Choose a customer</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
          )}
        </div>

        <div data-step="1" className={hide(1)}>
          <h3 className="text-xl font-semibold">About their business</h3>
          <Group title="What kind of business?" cols>{CATEGORIES.map((c) => <Chip key={c} type="radio" name="category" value={c} label={c} />)}</Group>
          <div><label className="label" htmlFor="j-town">Town or city</label><input id="j-town" name="town" className="field" autoComplete="off" placeholder="e.g. Bristol" /></div>
          <Group title="Where are their customers?">{REACH.map((r) => <Chip key={r} type="radio" name="reach" value={r} label={r} />)}</Group>
        </div>

        <div data-step="2" className={hide(2)}>
          <h3 className="text-xl font-semibold">What is the job?</h3>
          <div><label className="label" htmlFor="j-title">Title</label><input id="j-title" name="title" className="field" autoComplete="off" placeholder="Leave blank and we'll write one" /></div>
          <Group title="Type of job">{WORK_TYPES.map((w, i) => <Chip key={w.id} type="radio" name="work" value={w.id} label={w.label} hint={w.hint} defaultChecked={i === 0} />)}</Group>
          <Group title="Anything extra? (pick any)" cols>{EXTRAS.map((x) => <Chip key={x} type="checkbox" name="extras" value={x} label={x} />)}</Group>
          <div><label className="label" htmlFor="j-desc">Description</label><textarea id="j-desc" name="description" rows={3} className="field" placeholder="What does the customer want? Plain words are fine." /></div>
        </div>

        <div data-step="3" className={hide(3)}>
          <h3 className="text-xl font-semibold">A few details</h3>
          <Group title="How big?">{SIZES.map((x) => <Chip key={x} type="radio" name="size" value={x} label={x} />)}</Group>
          <Group title="Web address">{DOMAINS.map((x) => <Chip key={x} type="radio" name="domain" value={x} label={x} />)}</Group>
          <Group title="Words and photos">{CONTENT.map((x) => <Chip key={x} type="radio" name="content" value={x} label={x} />)}</Group>
          <Group title="How soon do they want it?">{TIMING.map((x) => <Chip key={x} type="radio" name="timing" value={x} label={x} />)}</Group>
        </div>

        <div data-step="4" className={hide(4)}>
          <h3 className="text-xl font-semibold">Priority and price</h3>
          <Group title="Priority" cols>{PRIORITIES.map((p) => <Chip key={p.id} type="radio" name="priority" value={p.id} label={p.label} defaultChecked={p.id === "normal"} />)}</Group>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="j-due">Due date</label><input id="j-due" name="dueDate" type="date" className="field" /></div>
            <div><label className="label" htmlFor="j-who">Assigned to</label>
              <select id="j-who" name="assigneeId" className="field" defaultValue=""><option value="">Me</option>{team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          </div>
          <fieldset>
            <legend className="label mb-2">What are we charging? (£)</legend>
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="grid grid-cols-[1fr_6.5rem] gap-2">
                  <input aria-label={`Item ${i + 1}`} name={`l${i}d`} className="field" placeholder={i === 0 ? "Website design and build" : i === 1 ? "Hosting and upkeep" : "Anything else"} required={i === 0} />
                  <input aria-label={`Price ${i + 1}`} name={`l${i}p`} type="number" min={0} step="0.01" inputMode="decimal" className="field" placeholder="0.00" required={i === 0} />
                  <label className="col-span-2 flex min-h-9 items-center gap-2 text-sm text-muted"><input type="checkbox" name={`l${i}r`} />Repeats every month or year</label>
                </div>
              ))}
            </div>
          </fieldset>
          <div><label className="label" htmlFor="j-rp">Repeating items are charged</label>
            <select id="j-rp" name="recurringPeriod" className="field" defaultValue=""><option value="">Not applicable</option><option value="month">Monthly</option><option value="year">Yearly</option></select></div>
          <Group title="How do they pay?">{PAYMENT_PLANS.map((p, i) => <Chip key={p.id} type="radio" name="plan" value={p.id} label={p.label} defaultChecked={i === 0} />)}</Group>
          <div><label className="label" htmlFor="j-notes">Anything else to note?</label><textarea id="j-notes" name="notes" rows={3} className="field" /></div>
        </div>
      </div>

      <footer className="flex gap-2 border-t border-line bg-white px-5 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        {step > (presetCustomer ? 1 : 0) && <button type="button" className="btn btn-quiet" onClick={() => go(step - 1)}>Back</button>}
        {last ? <button className="btn flex-1" disabled={pending}>{pending ? "Saving…" : "Create job"}</button> : <button type="button" className="btn flex-1" onClick={next}>Continue</button>}
      </footer>
    </form>
  );
}

function Dialog({ customers, team }: { customers: Person[]; team: Person[] }) {
  const sp = useSearchParams(), path = usePathname(), router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const wanted = sp.get("new") === "job";
  const [key, setKey] = useState(0);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (wanted && !d.open) { setKey((k) => k + 1); d.showModal(); document.body.style.overflow = "hidden"; }
    if (!wanted && d.open) { d.close(); }
    if (!wanted) document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [wanted]);
  const close = () => { const q = new URLSearchParams(sp.toString()); q.delete("new"); q.delete("customer"); router.replace(q.size ? `${path}?${q}` : path); };
  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); close(); }} onClick={(e) => { if (e.target === ref.current) close(); }}
      className="m-0 h-dvh w-dvw max-h-none max-w-none bg-white p-0 backdrop:bg-[rgba(14,19,17,.45)] sm:m-auto sm:h-[min(44rem,90dvh)] sm:w-[34rem] sm:rounded-2xl sm:shadow-[0_20px_60px_rgba(14,19,17,.2)]">
      {wanted && <Wizard key={key} customers={customers} team={team} presetCustomer={sp.get("customer") ?? undefined} close={close} />}
    </dialog>
  );
}

export function NewJob({ customers, team }: { customers: Person[]; team: Person[] }) {
  return <Suspense fallback={null}><Dialog customers={customers} team={team} /></Suspense>;
}
