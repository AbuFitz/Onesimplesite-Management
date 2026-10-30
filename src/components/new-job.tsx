"use client";
import { Suspense, useActionState, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { createJobAction } from "@/app/actions/job";
import { CATEGORIES, REACH, WORK_TYPES, EXTRAS, SIZES, DOMAINS, CONTENT, TIMING, PAYMENT_PLANS, PRIORITIES, SOURCES } from "@/modules/sales/job-options";
import { ErrorSummary } from "./ui";

const STEPS = ["Customer", "Ticket details", "Priority and price"] as const;

const Sel = ({ id, name, label, options, empty, defaultValue = "", required, className = "" }: { id: string; name: string; label: string; options: readonly (string | { value: string; label: string })[]; empty?: string; defaultValue?: string; required?: boolean; className?: string }) => (
  <div className={className}>
    <label className="label" htmlFor={id}>{label}</label>
    <select id={id} name={name} className="field" defaultValue={defaultValue} required={required}>
      {empty !== undefined && <option value="">{empty}</option>}
      {options.map((o) => { const v = typeof o === "string" ? { value: o, label: o } : o; return <option key={v.value} value={v.value}>{v.label}</option>; })}
    </select>
  </div>
);
const Field = ({ id, name, label, className = "", ...rest }: { id: string; name: string; label: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className={className}><label className="label" htmlFor={id}>{label}</label><input id={id} name={name} className="field" {...rest} /></div>
);

function Chip({ name, value, label }: { name: string; value: string; label: string }) {
  return (
    <label className="block cursor-pointer">
      <input type="checkbox" name={name} value={value} className="peer sr-only" />
      <span className="flex min-h-10 items-center rounded-lg border border-line px-3 text-sm transition-colors peer-checked:border-moss peer-checked:bg-[#eef7f2] peer-checked:text-moss peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ink">{label}</span>
    </label>
  );
}

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
  const pane = (n: number) => (step === n ? "grid gap-x-5 gap-y-4 sm:grid-cols-2" : "hidden");
  const full = "sm:col-span-2";

  return (
    <form action={act} className="flex h-full flex-col">
      <input type="hidden" name="who" value={who} />
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-8" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
        <div><h2 className="text-base">New ticket</h2><p className="text-sm text-muted">Step {step + 1} of {STEPS.length} · {STEPS[step]}</p></div>
        <button type="button" onClick={close} aria-label="Close" className="btn btn-quiet h-10 w-10 !p-0"><X size={18} /></button>
      </header>
      <div className="flex gap-1 px-5 pt-3 sm:px-8" aria-hidden>{STEPS.map((_, i) => <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-moss" : "bg-line"}`} />)}</div>

      <div ref={body} className="flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
        <ErrorSummary message={s?.error} />

        <div data-step="0" className={pane(0)}>
          <div className={`grid grid-cols-2 gap-2 ${full}`} role="group" aria-label="New or existing customer">
            <button type="button" aria-pressed={who === "new"} onClick={() => setWho("new")} className={`btn ${who === "new" ? "" : "btn-quiet"}`}>New customer</button>
            <button type="button" aria-pressed={who === "existing"} onClick={() => setWho("existing")} className={`btn ${who === "existing" ? "" : "btn-quiet"}`}>Existing customer</button>
          </div>
          {who === "new" ? (
            <>
              <Field id="j-biz" name="displayName" label="Business name" autoComplete="off" required />
              <Field id="j-contact" name="contactName" label="Contact's name" autoComplete="off" required />
              <Field id="j-email" name="email" label="Email" type="email" inputMode="email" autoCapitalize="none" />
              <Field id="j-phone" name="phone" label="Phone" type="tel" inputMode="tel" />
              <Sel id="j-source" name="source" label="How did they get in touch?" options={SOURCES} empty="Not sure" />
            </>
          ) : (
            <div className={full}>
              <label className="label" htmlFor="j-cust">Customer</label>
              <select id="j-cust" name="customerId" className="field" defaultValue={presetCustomer ?? ""} required>
                <option value="" disabled>Choose a customer</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>

        <div data-step="1" className={pane(1)}>
          <Field id="j-title" name="title" label="Title" className={full} autoComplete="off" placeholder="Leave blank and we'll write one" />
          <Sel id="j-work" name="work" label="Type of work" options={WORK_TYPES.map((w) => ({ value: w.id, label: w.label }))} defaultValue="simple" />
          <Sel id="j-size" name="size" label="Size" options={SIZES} empty="Not sure yet" />
          <Sel id="j-cat" name="category" label="Type of business" options={CATEGORIES} empty="Choose…" />
          <Field id="j-town" name="town" label="Town or city" autoComplete="off" placeholder="e.g. Bristol" />
          <Sel id="j-reach" name="reach" label="Where are their customers?" options={REACH} empty="Choose…" />
          <Sel id="j-domain" name="domain" label="Web address" options={DOMAINS} empty="Choose…" />
          <Sel id="j-content" name="content" label="Words and photos" options={CONTENT} empty="Choose…" />
          <Sel id="j-timing" name="timing" label="How soon do they want it?" options={TIMING} empty="Choose…" />
          <fieldset className={full}><legend className="label mb-2">Extras they want</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{EXTRAS.map((x) => <Chip key={x} name="extras" value={x} label={x} />)}</div></fieldset>
          <div className={full}><label className="label" htmlFor="j-desc">Description</label><textarea id="j-desc" name="description" rows={3} className="field" placeholder="What does the customer want? Plain words are fine." /></div>
        </div>

        <div data-step="2" className={pane(2)}>
          <Sel id="j-pri" name="priority" label="Priority" options={PRIORITIES.map((p) => ({ value: p.id, label: p.label }))} defaultValue="normal" />
          <Field id="j-due" name="dueDate" label="Due date" type="date" />
          <div className={full}><label className="label" htmlFor="j-who">Assigned to</label>
            <select id="j-who" name="assigneeId" className="field" defaultValue=""><option value="">Me</option>{team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          <fieldset className={full}>
            <legend className="label mb-2">Price (£)</legend>
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="grid grid-cols-[1fr_6.5rem] items-center gap-2 sm:grid-cols-[1fr_8rem_auto]">
                  <input aria-label={`Item ${i + 1}`} name={`l${i}d`} className="field" placeholder={i === 0 ? "Website design and build" : i === 1 ? "Hosting and upkeep" : "Anything else"} required={i === 0} />
                  <input aria-label={`Price ${i + 1}`} name={`l${i}p`} type="number" min={0} step="0.01" inputMode="decimal" className="field" placeholder="0.00" required={i === 0} />
                  <label className="col-span-2 flex min-h-9 items-center gap-2 text-sm text-muted sm:col-span-1"><input type="checkbox" name={`l${i}r`} />Repeats</label>
                </div>
              ))}
            </div>
          </fieldset>
          <Sel id="j-rp" name="recurringPeriod" label="Repeating items are charged" options={[{ value: "month", label: "Monthly" }, { value: "year", label: "Yearly" }]} empty="Not applicable" />
          <Sel id="j-plan" name="plan" label="How do they pay?" options={PAYMENT_PLANS.map((p) => ({ value: p.id, label: p.label }))} defaultValue="split" />
          <div className={full}><label className="label" htmlFor="j-notes">Anything else to note?</label><textarea id="j-notes" name="notes" rows={3} className="field" /></div>
        </div>
      </div>

      <footer className="flex gap-2 border-t border-line bg-white px-5 py-3 sm:justify-end sm:px-8" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        {step > (presetCustomer ? 1 : 0) && <button type="button" className="btn btn-quiet" onClick={() => go(step - 1)}>Back</button>}
        {last ? <button className="btn flex-1 sm:flex-none sm:px-8" disabled={pending}>{pending ? "Saving…" : "Create ticket"}</button> : <button type="button" className="btn flex-1 sm:flex-none sm:px-8" onClick={next}>Continue</button>}
      </footer>
    </form>
  );
}

function Dialog({ customers, team }: { customers: Person[]; team: Person[] }) {
  const sp = useSearchParams(), path = usePathname(), router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const wanted = sp.get("new") === "ticket";
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
      className="m-0 h-dvh w-dvw max-h-none max-w-none bg-white p-0 backdrop:bg-[rgba(14,19,17,.45)] sm:m-auto sm:h-[min(46rem,92dvh)] sm:w-[min(52rem,94vw)] sm:rounded-2xl sm:shadow-[0_20px_60px_rgba(14,19,17,.2)]">
      {wanted && <Wizard key={key} customers={customers} team={team} presetCustomer={sp.get("customer") ?? undefined} close={close} />}
    </dialog>
  );
}

export function NewJob({ customers, team }: { customers: Person[]; team: Person[] }) {
  return <Suspense fallback={null}><Dialog customers={customers} team={team} /></Suspense>;
}
