/** Choices shown on the ticket forms. Plain data, safe to import in the browser. */
/** What someone is asking for, in their words. Four choices cover almost everything. */
export const TICKET_KINDS = [
  { id: "issue", label: "Something isn't working", hint: "A page, a form, a link or anything that looks wrong" },
  { id: "request", label: "I'd like a change", hint: "New text, photos, a new page or a tweak. If it's outside your plan, we'll tell you the cost before we start." },
  { id: "question", label: "I have a question", hint: "How something works, or what comes next" },
  { id: "billing", label: "Billing or my plan", hint: "An invoice, a payment or your care plan" },
] as const;

/** How urgent, in plain words. Each maps to a priority and tells them what to expect. */
export const URGENCY = [
  { id: "urgent", priority: "urgent", label: "My site is down, or something looks unsafe", expect: "We respond straight away, at any time." },
  { id: "high", priority: "high", label: "Something important is broken", expect: "We reply within one working day." },
  { id: "normal", priority: "normal", label: "It can wait a day or two", expect: "We reply within two working days." },
  { id: "low", priority: "low", label: "No rush", expect: "We reply within three working days." },
] as const;

/** Ticket status in the team's words. */
export const STATUS_LABEL: Record<string, { label: string; kind: "good" | "warn" | "bad" | "neutral" }> = {
  open: { label: "New", kind: "warn" }, in_progress: { label: "In progress", kind: "neutral" }, customer_replied: { label: "Customer replied", kind: "warn" },
  waiting_customer: { label: "Waiting on customer", kind: "neutral" }, resolved: { label: "Resolved", kind: "good" }, closed: { label: "Closed", kind: "neutral" },
};
export const CATEGORY_LABEL: Record<string, { label: string; cls: string }> = {
  onboarding: { label: "New website", cls: "bg-[#dff5ea] text-[#0a5a3d]" }, change_request: { label: "Change request", cls: "bg-[#fbf3d5] text-[#5c4700]" }, support: { label: "Support", cls: "bg-[#e3effa] text-[#0b3b57]" },
};
/** Sales stages in the same plain words as tickets. */
export const ONBOARDING_LABEL: Record<string, { label: string; kind: "good" | "warn" | "bad" | "neutral" }> = {
  new: { label: "New", kind: "warn" }, qualified: { label: "Quote in progress", kind: "neutral" }, proposal_sent: { label: "Quote sent", kind: "neutral" },
  contract_pending: { label: "Waiting to sign", kind: "warn" }, won: { label: "Signed", kind: "good" }, lost: { label: "Lost", kind: "bad" },
};
