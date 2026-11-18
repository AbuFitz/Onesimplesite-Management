"use client";
import { useActionState, useState } from "react";
import { Bug, Pencil, HelpCircle, CreditCard } from "lucide-react";
import { createTicketAction } from "@/app/actions/portal";
import { TICKET_KINDS, URGENCY } from "@/modules/support/options";
import { ErrorSummary } from "./ui";
import { FilePicker } from "./file-picker";
import { SubmitButton } from "./submit-button";
import { Wizard, type ReviewRow } from "./wizard";

const ICONS = { issue: Bug, request: Pencil, question: HelpCircle, billing: CreditCard } as const;

/** The customer's way to ask for help: what it is, the details, how urgent, then a check. The same step-by-step component the team uses. */
export function TicketForm({ accounts, projects }: { accounts: { id: string; name: string }[]; projects: { id: string; name: string; customerId: string }[] }) {
  const [s, act] = useActionState(createTicketAction, undefined as { error?: string } | undefined);
  const [kind, setKind] = useState("");
  const [urgency, setUrgency] = useState("normal");
  const [account, setAccount] = useState(accounts[0]?.id ?? "");
  const k = TICKET_KINDS.find((x) => x.id === kind);
  const review = (fd: FormData): ReviewRow[] => {
    const files = fd.getAll("files").filter((f) => f instanceof File && f.size > 0).length;
    const u = URGENCY.find((x) => x.id === String(fd.get("urgency") ?? ""));
    return [
      { label: "About", value: k?.label ?? "", step: "kind" },
      { label: "Title", value: String(fd.get("title") ?? ""), step: "details" },
      { label: "Details", value: String(fd.get("body") ?? "").slice(0, 240), step: "details" },
      { label: "Files", value: files ? `${files} attached` : "", step: "details" },
      { label: "How urgent", value: u ? `${u.label}. ${u.expect}` : "", step: "urgency" },
      ...(accounts.length > 1 ? [{ label: "Company", value: accounts.find((a) => a.id === account)?.name ?? "", step: "urgency" }] : []),
    ];
  };
  return (
    <Wizard action={act} review={review} draftKey="portal-ticket" later={{ href: "/help" }} errorMessage={s?.error} onRestore={(v) => { if (typeof v.kind === "string" && v.kind) setKind(v.kind); }} error={<ErrorSummary message={s?.error} />}
      actions={<SubmitButton pendingText="Sending…">Send to the team</SubmitButton>}
      steps={[
        { id: "kind", title: "About", ready: !!kind, hint: "What's it about? Pick the closest one. You can explain in a moment.", node: (
          <div className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="kind" value={kind} />
            {TICKET_KINDS.map((x) => { const Icon = ICONS[x.id]; return (
              <button type="button" key={x.id} aria-pressed={kind === x.id} onClick={() => setKind(x.id)} className={`tc-type ${kind === x.id ? "on" : ""}`}>
                <span className="tc-ico"><Icon size={20} aria-hidden /></span><b>{x.label}</b><small>{x.hint}</small>
              </button>); })}
          </div>) },
        { id: "details", title: "Details", hint: kind === "request" ? "What would you like changed? Say where on the site if you can." : kind === "billing" ? "What's the question about your payments?" : "What were you doing, and what happened instead?", node: (
          <div className="tc-write">
            <label className="sr-only" htmlFor="tk-title">A short title</label>
            <input id="tk-title" name="title" className="evf-title" placeholder={kind === "request" ? "A short title, e.g. Update our opening hours" : "A short title, e.g. The contact form isn't sending"} maxLength={140} required minLength={3} autoComplete="off" />
            <label className="tc-leg" htmlFor="tk-body">The details</label>
            <textarea id="tk-body" name="body" rows={6} className="field" required minLength={5} placeholder="The more you tell us, the quicker we can sort it." />
            <FilePicker hint="A screenshot helps a lot. Photos are shrunk for you." />
          </div>) },
        { id: "urgency", title: "Urgency", hint: "How urgent is it? This just tells us what to look at first.", node: (
          <>
            <div className="opts" role="radiogroup" aria-label="How urgent is it?">
              {URGENCY.map((x) => <label key={x.id} className="opt"><input type="radio" name="urgency" value={x.id} checked={urgency === x.id} onChange={() => setUrgency(x.id)} /><span><b>{x.label}</b><small>{x.expect}</small></span></label>)}
            </div>
            {(projects.length > 0 || accounts.length > 1) && (
              <div className="grp">
                {projects.length > 0 && <label className="grp-row" htmlFor="tk-proj"><span>Website</span><select id="tk-proj" name="projectId" defaultValue=""><option value="">Not sure, or not a specific one</option>{projects.filter((p) => accounts.length < 2 || p.customerId === account).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
                {accounts.length > 1 && <label className="grp-row" htmlFor="tk-acc"><span>Company</span><select id="tk-acc" name="customerId" value={account} onChange={(e) => setAccount(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
              </div>
            )}
          </>) },
      ]} />
  );
}
