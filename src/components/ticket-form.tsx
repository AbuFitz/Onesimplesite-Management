"use client";
import { useActionState, useRef, useState } from "react";
import { Bug, Pencil, HelpCircle, CreditCard, ArrowLeft, ArrowRight, Check, Send } from "lucide-react";
import { createTicketAction } from "@/app/actions/portal";
import { TICKET_KINDS, URGENCY } from "@/modules/support/options";
import { ErrorSummary } from "./ui";
import { FilePicker } from "./file-picker";

const ICONS = { issue: Bug, request: Pencil, question: HelpCircle, billing: CreditCard } as const;
const TONES = { issue: "bg-blush", request: "bg-butter", question: "bg-sky", billing: "bg-lilac" } as const;
const STEPS = ["What's it about?", "Tell us more", "How urgent?", "Check and send"] as const;
const big = "font-[family-name:var(--font-display)] text-2xl font-bold sm:text-3xl";

/** One question at a time. Everything stays in one form, so a single "Send" submits it all. */
export function TicketForm({ accounts, projects }: { accounts: { id: string; name: string }[]; projects: { id: string; name: string; customerId: string }[] }) {
  const [s, act, pending] = useActionState(createTicketAction, undefined as { error?: string } | undefined);
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<string>("");
  const [urgency, setUrgency] = useState("normal");
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const [project, setProject] = useState("");
  const [account, setAccount] = useState(accounts[0]?.id ?? "");
  const form = useRef<HTMLFormElement>(null);
  const pane = (n: number) => (step === n ? "block" : "hidden");
  const k = TICKET_KINDS.find((x) => x.id === kind);
  const u = URGENCY.find((x) => x.id === urgency)!;
  const files = () => form.current?.querySelector<HTMLInputElement>("input[type=file]")?.files?.length ?? 0;

  function go(n: number) { setStep(n); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function next() {
    const els = form.current?.querySelectorAll<HTMLInputElement>(`[data-step="${step}"] :is(input,textarea,select):not([type=file])`);
    for (const el of Array.from(els ?? [])) if (!el.reportValidity()) return;
    go(step + 1);
  }
  const tile = "flex cursor-pointer gap-3 rounded-2xl border-2 p-4 text-left transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink";

  return (
    <form ref={form} action={act} className="mx-auto max-w-2xl">
      <ErrorSummary message={s?.error} />
      <div className="mb-5 sm:mb-8">
        <div className="mb-2 flex items-center justify-between text-sm font-semibold"><span>Raise a ticket</span><span className="text-muted">Step {step + 1} of {STEPS.length}</span></div>
        <div className="flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label="Progress">{STEPS.map((_, i) => <div key={i} className={`h-2 flex-1 rounded-full transition-colors ${i <= step ? "bg-ink" : "bg-bone"}`} />)}</div>
      </div>
      <input type="hidden" name="kind" value={kind} /><input type="hidden" name="urgency" value={urgency} />

      <div data-step="0" className={pane(0)}>
        <h2 className={big}>What's it about?</h2>
        <p className="mb-5 mt-1 text-muted">Pick the closest one. You can explain in a moment.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {TICKET_KINDS.map((x) => { const Icon = ICONS[x.id]; const on = kind === x.id; return (
            <button type="button" key={x.id} aria-pressed={on} onClick={() => { setKind(x.id); go(1); }} className={`${tile} items-start ${on ? "border-ink " + TONES[x.id] : "border-transparent bg-white hover:border-line"}`}>
              <span className={`mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl ${TONES[x.id]}`}><Icon size={22} aria-hidden /></span>
              <span><span className="block text-lg font-bold">{x.label}</span><span className="block text-sm text-muted">{x.hint}</span></span>
            </button>); })}
        </div>
      </div>

      <div data-step="1" className={pane(1)}>
        <h2 className={big}>Tell us what's happening</h2>
        <p className="mb-5 mt-1 text-muted">{kind === "request" ? "What would you like changed? Say where on the site if you can." : kind === "billing" ? "What's the question about your payments?" : "What were you doing, and what happened instead?"}</p>
        <div className="space-y-5">
          <div><label className="label" htmlFor="tk-title">A short title</label><input id="tk-title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} className="field !min-h-14 !text-lg" placeholder={kind === "request" ? "e.g. Update our opening hours" : "e.g. The contact form isn't sending"} maxLength={140} required minLength={3} autoComplete="off" /></div>
          <div><label className="label" htmlFor="tk-body">The details</label><textarea id="tk-body" name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={7} className="field" required minLength={5} placeholder="The more you tell us, the quicker we can sort it." /></div>
          <FilePicker hint="A screenshot helps a lot. Photos are shrunk for you." />
        </div>
      </div>

      <div data-step="2" className={pane(2)}>
        <h2 className={big}>How urgent is it?</h2>
        <p className="mb-5 mt-1 text-muted">This just tells us what to look at first.</p>
        <div className="grid gap-3">
          {URGENCY.map((x) => (
            <button type="button" key={x.id} aria-pressed={urgency === x.id} onClick={() => setUrgency(x.id)} className={`${tile} items-center ${urgency === x.id ? "border-ink bg-mint" : "border-transparent bg-white hover:border-line"}`}>
              <span className={`grid size-6 shrink-0 place-items-center rounded-full border-2 ${urgency === x.id ? "border-ink bg-ink text-white" : "border-line"}`}>{urgency === x.id && <Check size={14} aria-hidden />}</span>
              <span><span className="block font-bold">{x.label}</span><span className="block text-sm text-muted">{x.expect}</span></span>
            </button>
          ))}
        </div>
        <div className="mt-6 space-y-4">
          {projects.length > 0 && <div><label className="label" htmlFor="tk-proj">Is it about one of your websites? <span className="font-normal text-muted">(optional)</span></label><select id="tk-proj" name="projectId" value={project} onChange={(e) => setProject(e.target.value)} className="field"><option value="">Not sure, or not a specific one</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
          {accounts.length > 1 && <div><label className="label" htmlFor="tk-acc">Which business is this for?</label><select id="tk-acc" name="customerId" value={account} onChange={(e) => setAccount(e.target.value)} className="field">{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>}
        </div>
      </div>

      <div data-step="3" className={pane(3)}>
        <h2 className={big}>Check and send</h2>
        <p className="mb-5 mt-1 text-muted">Everything look right? We'll email you a copy.</p>
        <dl className="divide-y divide-line overflow-hidden rounded-2xl bg-white">
          {[["About", k?.label ?? "", 0], ["Title", title, 1], ["Details", body.length > 220 ? `${body.slice(0, 220)}…` : body, 1], ["Files", files() ? `${files()} attached` : "None", 1], ["Urgency", u.label, 2], ...(accounts.length > 1 ? [["Business", accounts.find((a) => a.id === account)?.name ?? "", 2] as [string, string, number]] : [])].map(([l, v, to]) => (
            <div key={String(l)} className="grid gap-1 px-4 py-3 sm:grid-cols-[7rem_1fr_auto] sm:items-start sm:gap-4"><dt className="text-sm font-semibold text-muted">{l}</dt><dd className="whitespace-pre-wrap break-words">{String(v) || "—"}</dd><button type="button" onClick={() => go(Number(to))} className="justify-self-start text-sm font-semibold underline sm:justify-self-end">Change</button></div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-muted">{u.expect}</p>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        {step > 0 ? <button type="button" onClick={() => go(step - 1)} className="btn btn-quiet"><ArrowLeft size={16} aria-hidden /> Back</button> : <span />}
        {step === 1 || step === 2 ? <button type="button" onClick={next} className="btn btn-dark !min-h-12 px-6">Continue <ArrowRight size={16} aria-hidden /></button> : null}
        {step === 3 && <button className="btn btn-dark !min-h-12 px-6" disabled={pending}><Send size={16} aria-hidden /> {pending ? "Sending…" : "Send to the team"}</button>}
      </div>
    </form>
  );
}
