/**
 * Which emails actually get sent. The app already shows everything in the app (tickets, the suggestions bubble, the Today page, the order pages),
 * so most notices to the team do not need an email at all. Each one can be: sent straight away, bundled into one daily summary, or not emailed.
 * Customer emails that carry something they need (invitations, agreements, receipts, replies, prices) are never optional.
 */
export type Delivery = "instant" | "digest" | "off";
export type NotifyEvent = { topic: string; who: "team" | "customer"; label: string; help: string; default: Delivery; modes: Delivery[] };

export const NOTIFY_EVENTS: NotifyEvent[] = [
  { topic: "email.signing_notice", who: "team", label: "A customer signs an agreement", help: "The signed PDF is attached. Worth having straight away.", default: "instant", modes: ["instant", "digest", "off"] },
  { topic: "email.payment_notice", who: "team", label: "Payments: received, plan started or cancelled, payment failed", help: "A failed payment is always sent straight away so you can call them.", default: "digest", modes: ["instant", "digest", "off"] },
  { topic: "email.ticket_notice", who: "team", label: "A customer raises or replies to a ticket", help: "Urgent tickets are always sent straight away. Everything is also in Tickets and the suggestions bubble.", default: "digest", modes: ["instant", "digest", "off"] },
  { topic: "email.change_request_decision", who: "team", label: "A customer approves or declines a price", help: "It shows on the ticket and in the bubble.", default: "digest", modes: ["instant", "digest", "off"] },
  { topic: "email.access_request_notice", who: "team", label: "A customer asks to add someone to their portal", help: "It shows in the bubble and on the business's People tab.", default: "digest", modes: ["instant", "digest", "off"] },
  { topic: "email.ticket_team_reminder", who: "team", label: "Reminder that customers are waiting on us", help: "The bubble and Today page already show this.", default: "digest", modes: ["instant", "digest", "off"] },
  { topic: "email.backup_reminder", who: "team", label: "Weekly backup reminder", help: "Only when a backup is overdue.", default: "instant", modes: ["instant", "digest", "off"] },
  { topic: "email.ticket_received", who: "customer", label: "“We've got your ticket” confirmation", help: "The portal already confirms it on screen, so this is off unless you want it.", default: "off", modes: ["instant", "off"] },
  { topic: "email.ticket_resolved", who: "customer", label: "“This one's sorted” when we resolve a ticket", help: "They can see the status in their portal.", default: "off", modes: ["instant", "off"] },
  { topic: "email.ticket_reminder", who: "customer", label: "Nudges when we're waiting to hear from them", help: "At 3 and 7 days after our reply.", default: "instant", modes: ["instant", "off"] },
];
export const DELIVERY_LABEL: Record<Delivery, string> = { instant: "Email straight away", digest: "Daily summary", off: "No email (in the app only)" };

export type Prefs = Partial<Record<string, Delivery>>;
export const prefsFrom = (settings: unknown): Prefs => { const n = (settings as { notify?: unknown } | null)?.notify; return n && typeof n === "object" ? (n as Prefs) : {}; };

/** What to do with one email about to be queued. `null` means "this email isn't configurable: just send it". */
export function resolveDelivery(prefs: Prefs, topic: string, payload: Record<string, unknown>): Delivery | null {
  const ev = NOTIFY_EVENTS.find((e) => e.topic === topic);
  if (!ev) return null;
  const chosen = prefs[topic];
  let mode: Delivery = chosen && ev.modes.includes(chosen) ? chosen : ev.default;
  // Some things are too important to wait for a summary, unless you switched that email off completely.
  if (mode === "digest") {
    if (topic === "email.ticket_notice" && payload.priority === "urgent") mode = "instant";
    if (topic === "email.payment_notice" && payload.event === "failed") mode = "instant";
  }
  return mode;
}
