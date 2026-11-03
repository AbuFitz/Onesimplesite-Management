/** Choices shown on the ticket forms. Plain data, safe to import in the browser. */
/** What someone is asking for, in their words. Four choices cover almost everything. */
export const TICKET_KINDS = [
  { id: "issue", label: "Something isn't working", hint: "A page, a form, a link or anything that looks wrong" },
  { id: "request", label: "I'd like a change", hint: "New text, photos, a new page or a tweak" },
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

