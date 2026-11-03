"use client";
import { useActionState } from "react";
import { Bug, Pencil, HelpCircle, CreditCard } from "lucide-react";
import { createTicketAction } from "@/app/actions/portal";
import { TICKET_KINDS, URGENCY } from "@/modules/support/options";
import { ErrorSummary } from "./ui";
import { FilePicker } from "./file-picker";

const ICONS = { issue: Bug, request: Pencil, question: HelpCircle, billing: CreditCard } as const;
const card = "flex cursor-pointer gap-3 rounded-2xl border-2 border-transparent bg-white p-4 text-left transition-colors has-[:checked]:border-ink has-[:checked]:bg-mint has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink";

/** Four questions, all easy. Big tap targets, plain words. */
export function TicketForm({ accounts, projects }: { accounts: { id: string; name: string }[]; projects: { id: string; name: string; customerId: string }[] }) {
  const [s, act, pending] = useActionState(createTicketAction, undefined as { error?: string } | undefined);
  return (
    <form action={act} className="space-y-8">
      <ErrorSummary message={s?.error} />
      {accounts.length > 1 && (
        <div><label className="label" htmlFor="tk-acc">Which business is this for?</label>
          <select id="tk-acc" name="customerId" className="field" defaultValue={accounts[0].id}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
      )}
      <fieldset>
        <legend className="mb-3 font-[family-name:var(--font-display)] text-xl font-bold">1. What's it about?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {TICKET_KINDS.map((k, i) => { const Icon = ICONS[k.id]; return (
            <label key={k.id} className={card}><input type="radio" name="kind" value={k.id} defaultChecked={i === 0} className="sr-only" /><span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-bone"><Icon size={20} aria-hidden /></span><span><span className="block font-bold">{k.label}</span><span className="block text-sm text-muted">{k.hint}</span></span></label>
          ); })}
        </div>
      </fieldset>
      <div>
        <label className="mb-3 block font-[family-name:var(--font-display)] text-xl font-bold" htmlFor="tk-title">2. Give it a short title</label>
        <input id="tk-title" name="title" className="field !min-h-14 !text-lg" placeholder="e.g. The contact form isn't sending" maxLength={140} required autoComplete="off" />
      </div>
      <div>
        <label className="mb-1 block font-[family-name:var(--font-display)] text-xl font-bold" htmlFor="tk-body">3. Tell us what's happening</label>
        <p className="mb-3 text-sm text-muted">What were you doing, what did you expect, and what happened instead? Add the page address if you can.</p>
        <textarea id="tk-body" name="body" rows={6} className="field" required />
      </div>
      <FilePicker hint="A screenshot helps a lot. Photos are shrunk for you." />
      {projects.length > 0 && (
        <div><label className="label" htmlFor="tk-proj">Is it about one of your websites? <span className="font-normal text-muted">(optional)</span></label>
          <select id="tk-proj" name="projectId" className="field" defaultValue=""><option value="">Not sure, or not a specific one</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      )}
      <fieldset>
        <legend className="mb-3 font-[family-name:var(--font-display)] text-xl font-bold">4. How urgent is it?</legend>
        <div className="grid gap-3">
          {URGENCY.map((u) => (
            <label key={u.id} className={card}><input type="radio" name="urgency" value={u.id} defaultChecked={u.id === "normal"} className="sr-only" /><span><span className="block font-bold">{u.label}</span><span className="block text-sm text-muted">{u.expect}</span></span></label>
          ))}
        </div>
      </fieldset>
      <button className="btn btn-dark w-full sm:w-auto sm:px-10" disabled={pending}>{pending ? "Sending…" : "Send to the team"}</button>
    </form>
  );
}
