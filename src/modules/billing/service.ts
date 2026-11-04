import { db } from "@/lib/db";
import { audit, enqueue } from "@/lib/audit";
import type { Tx } from "@/lib/db";
import { DomainError, forbidden, notFound } from "@/lib/errors";
import { ensureReceipt } from "./receipt";
import { addMonths, trialDays } from "./promo";
import { reportProblem } from "@/lib/problems";
import { portalLink, manageLink } from "@/lib/env";
import { stripe, stripeReady, stripeSubId } from "@/lib/stripe";
import { can } from "@/modules/identity/permissions";
import type { StaffCtx } from "@/modules/identity/session";
import type { ClientCtx } from "@/modules/portal/service";
import { clientCan, customersWhere } from "@/modules/portal/access";

export const money = (minor: number, cur = "GBP") => new Intl.NumberFormat("en-GB", { style: "currency", currency: cur }).format(minor / 100);

/** What each kind of charge is called, in plain words. */
export const KIND_LABEL: Record<string, string> = { one_off: "Website", deposit: "Deposit", balance: "Final payment", recurring_setup: "Monthly plan", change: "Change request" };
export const isMonthly = (kind: string) => kind === "recurring_setup";

/** Status in plain words. */
export function plainStatus(kind: string, status: string, cancelsAt?: Date | null, trialEndsAt?: Date | null): { label: string; tone: "due" | "ok" | "warn" | "off" } {
  if (cancelsAt && (status === "active" || status === "past_due")) return { label: `Ends ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" }).format(cancelsAt)}`, tone: "warn" };
  if (status === "paid") return { label: "Paid", tone: "ok" };
  if (status === "active" && trialEndsAt && trialEndsAt > new Date()) return { label: `Free until ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" }).format(trialEndsAt)}`, tone: "ok" };
  if (status === "active") return { label: "Active", tone: "ok" };
  if (status === "past_due") return { label: "Payment failed", tone: "warn" };
  if (status === "cancelled") return { label: "Cancelled", tone: "off" };
  return { label: isMonthly(kind) ? "Not started" : "Due", tone: "due" };
}

const clientScope = (c: ClientCtx) => ({ customerId: { in: customersWhere(c, "billing") } });
const include = { contract: { select: { title: true, reference: true, status: true } }, ticket: { select: { id: true, title: true, reference: true } } } as const;
/** Name and reference of whatever a charge belongs to: an order, or a change request. */
export const chargeOf = (b: { contract?: { title: string; reference: string } | null; ticket?: { title: string; reference: string } | null }) => ({ title: b.contract?.title ?? b.ticket?.title ?? "Payment", reference: b.contract?.reference ?? b.ticket?.reference ?? "" });

/** Only signed-and-completed orders bill. */
export const clientBilling = (c: ClientCtx) =>
  db.billingIntent.findMany({ where: { ...clientScope(c), OR: [{ contract: { status: "completed" } }, { ticketId: { not: null } }] }, orderBy: { createdAt: "asc" }, include });

const stripeMode = () => ((process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live") ? "live" : "test");
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The Stripe customer for a company. A customer made in test mode does not exist in live mode (and the reverse), so a stale id is replaced instead of failing the payment. */
async function stripeCustomer(customerId: string, email: string | undefined, name: string, fresh = false) {
  const cu = await db.customer.findUniqueOrThrow({ where: { id: customerId }, select: { stripeCustomerId: true, displayName: true, reference: true } });
  if (cu.stripeCustomerId && !fresh) return cu.stripeCustomerId;
  const body = { name: cu.displayName, email: email || undefined, metadata: { customerId, reference: cu.reference, contact: name } };
  const made = await stripe<{ id: string }>("/customers", body, { idempotencyKey: `cust:${customerId}:${stripeMode()}${fresh ? `:${Date.now()}` : ""}` })
    .catch((e) => (/idempoten/i.test(errText(e)) ? stripe<{ id: string }>("/customers", body) : Promise.reject(e)));
  await db.customer.updateMany({ where: { id: customerId }, data: { stripeCustomerId: made.id } });
  return made.id;
}

/** Starts a secure Stripe checkout for one charge and returns its page address. */
export async function startPayment(c: ClientCtx, intentId: string): Promise<string> {
  if (!stripeReady()) throw new DomainError("conflict", "Card payments aren't switched on yet. Please contact us and we'll send you the details.");
  const b = await db.billingIntent.findFirst({ where: { id: intentId, ...clientScope(c), OR: [{ contract: { status: "completed" } }, { ticketId: { not: null } }] }, include });
  if (!b) throw notFound();
  if (b.status === "paid" || b.status === "active") throw new DomainError("conflict", "This one is already paid.");
  if (b.status === "cancelled") throw new DomainError("conflict", "This charge was cancelled. Please contact us.");
  const monthly = isMonthly(b.kind);
  const make = async (fresh: boolean) => {
    const customer = await stripeCustomer(b.customerId, c.email || undefined, c.name ?? "", fresh);
  const line = { quantity: 1, price_data: { currency: b.currency.toLowerCase(), unit_amount: b.amountMinor, product_data: { name: `${b.description ?? KIND_LABEL[b.kind] ?? "OneSimpleSite"} (${chargeOf(b).reference})` }, ...(monthly ? { recurring: { interval: "month" } } : {}) } };
    return stripe<{ id: string; url: string }>("/checkout/sessions", {
    mode: monthly ? "subscription" : "payment", customer, line_items: [line], payment_method_types: ["card"],
    success_url: portalLink("/billing?paid=1"), cancel_url: portalLink("/billing"),
    client_reference_id: b.id, metadata: { intentId: b.id, contract: chargeOf(b).reference },
    ...(monthly ? { subscription_data: { metadata: { intentId: b.id }, ...(b.trialMonths > 0 ? { trial_period_days: trialDays(new Date(), b.trialMonths) } : {}) }, ...(b.trialMonths > 0 ? { payment_method_collection: "always" } : {}) } : { payment_intent_data: { metadata: { intentId: b.id }, description: `${chargeOf(b).reference} ${KIND_LABEL[b.kind] ?? ""}` } }),
  });
  };
  let s: { id: string; url: string };
  try { s = await make(false); }
  catch (e) {
    if (/no such customer/i.test(errText(e))) s = await make(true).catch(async (e2) => { await reportProblem({ workspaceId: b.workspaceId, area: "payment_start", error: e2, customerId: b.customerId, ref: `${chargeOf(b).reference} ${b.kind}` }); throw new DomainError("conflict", "We couldn't start the payment. We've been told and will sort it out, or please contact us."); });
    else { await reportProblem({ workspaceId: b.workspaceId, area: "payment_start", error: e, customerId: b.customerId, ref: `${chargeOf(b).reference} ${b.kind}` }); throw new DomainError("conflict", "We couldn't start the payment. Please try again in a minute, or contact us if it keeps happening."); }
  }
  await db.billingIntent.update({ where: { id: b.id }, data: { stripeSessionId: s.id } });
  return s.url;
}

/** Stripe's own page where a customer updates their card or cancels the monthly plan. */
export async function openBillingPortal(c: ClientCtx): Promise<string> {
  if (!stripeReady()) throw new DomainError("conflict", "Card payments aren't switched on yet.");
  const cu = await db.customer.findFirst({ where: { id: { in: customersWhere(c, "billing") }, stripeCustomerId: { not: null } }, select: { stripeCustomerId: true } });
  if (!cu?.stripeCustomerId) throw new DomainError("conflict", "There's nothing to manage yet. It appears after your first payment.");
  const s = await stripe<{ url: string }>("/billing_portal/sessions", { customer: cu.stripeCustomerId, return_url: portalLink("/billing") });
  return s.url;
}


const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(d);
type Mailable = { id: string; workspaceId: string; customerId: string; contractId: string | null; ticketId?: string | null; kind: string; amountMinor: number; currency: string; description: string | null };

/** Emails the customer (whoever paid, else their main contact) and tells the team. Deduped per charge and event. */
async function payEmails(tx: Tx, b: Mailable, event: "paid" | "plan_started" | "failed" | "cancelled", hint: { email?: string | null; name?: string | null } = {}, key = "", rc?: { key: string; method: "card" | "bank" | "other"; stripeRef?: string | null }, trialEndsAt?: Date | null) {
  const [cu, k, primary] = await Promise.all([
    tx.customer.findUniqueOrThrow({ where: { id: b.customerId }, select: { displayName: true } }),
    b.contractId ? tx.contract.findUniqueOrThrow({ where: { id: b.contractId }, select: { reference: true } }) : tx.ticket.findUniqueOrThrow({ where: { id: b.ticketId! }, select: { reference: true } }),
    tx.contact.findFirst({ where: { customerId: b.customerId, email: { not: null } }, orderBy: { isPrimary: "desc" }, select: { name: true, email: true } }),
  ]);
  const what = b.description ?? KIND_LABEL[b.kind] ?? "Payment";
  const amount = money(b.amountMinor, b.currency);
  const to = hint.email || primary?.email, name = hint.name || primary?.name || "there";
  const dk = `${event}:${b.id}${key}`;
  const receipt = rc && (event === "paid" || event === "plan_started") ? await ensureReceipt(tx, b, rc) : null;
  if (to && event !== "cancelled") {
    const link = portalLink("/billing");
    if (event === "paid") await enqueue(tx, b.workspaceId, "email.payment_received", `pay.paid:${dk}`, { to, name, ref: k.reference, what, amount, paidOn: day(new Date()), link, ...(receipt ? { receiptId: receipt.id, receiptRef: receipt.ref } : {}) });
    else if (event === "plan_started") await enqueue(tx, b.workspaceId, "email.plan_started", `pay.plan:${dk}`, { to, name, ref: k.reference, amount, link, ...(trialEndsAt ? { freeUntil: day(trialEndsAt) } : {}), ...(receipt ? { receiptId: receipt.id, receiptRef: receipt.ref } : {}) });
    else await enqueue(tx, b.workspaceId, "email.payment_failed", `pay.failed:${dk}`, { to, name, ref: k.reference, what, amount, link });
  }
  await enqueue(tx, b.workspaceId, "email.payment_notice", `pay.notice:${dk}`, { to: "internal", event, business: cu.displayName, ref: k.reference, what, amount, link: manageLink(b.contractId ? `/contracts/${b.contractId}` : `/support/${b.ticketId}`) });
}

// ───────── Team side ─────────
const need = (ctx: StaffCtx) => { if (!can(ctx.role, "customer.read")) throw forbidden(); };
const needWrite = (ctx: StaffCtx) => { if (!can(ctx.role, "billing.write")) throw forbidden(); };

export async function staffBilling(ctx: StaffCtx, customerId: string) {
  need(ctx);
  return db.billingIntent.findMany({ where: { workspaceId: ctx.workspaceId, customerId }, orderBy: { createdAt: "asc" }, include });
}

/** Paid by bank transfer, cash or anything outside Stripe. */
export async function markPaidManually(ctx: StaffCtx, id: string, via: "bank" | "other" = "bank") {
  needWrite(ctx);
  const b = await db.billingIntent.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!b) throw notFound();
  if (isMonthly(b.kind)) throw new DomainError("conflict", "Monthly plans are started by the customer through Stripe.");
  if (b.status === "paid") return;
  await db.$transaction(async (tx) => {
    await tx.billingIntent.update({ where: { id }, data: { status: "paid", paidAt: new Date(), paidVia: via } });
    if (b.ticketId) await tx.ticket.update({ where: { id: b.ticketId }, data: { chargeStatus: "paid" } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "billing.paid_manually", targetType: "billing_intent", targetId: id, customerId: b.customerId, detail: { via, amountMinor: b.amountMinor } });
    await payEmails(tx, b, "paid", {}, "", { key: "manual", method: via === "bank" ? "bank" : "other" });
  });
}

export async function cancelCharge(ctx: StaffCtx, id: string) {
  needWrite(ctx);
  const b = await db.billingIntent.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!b) throw notFound();
  if (b.status === "paid" || b.status === "active") throw new DomainError("conflict", "This has been paid. Refund it in Stripe instead.");
  await db.$transaction(async (tx) => {
    await tx.billingIntent.update({ where: { id }, data: { status: "cancelled" } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "billing.cancelled", targetType: "billing_intent", targetId: id, customerId: b.customerId });
  });
}

/** Give a company free months at the start of their monthly plan, before they start it (for example after they signed, or a promise made on a call). */
export async function setPlanOffer(ctx: StaffCtx, id: string, months: number, label: string) {
  needWrite(ctx);
  if (!Number.isInteger(months) || months < 0 || months > 12) throw new DomainError("validation", "Choose between 0 and 12 free months.");
  const b = await db.billingIntent.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!b) throw notFound();
  if (!isMonthly(b.kind)) throw new DomainError("conflict", "Free months only apply to the monthly plan.");
  if (b.status !== "pending") throw new DomainError("conflict", "The plan has already started or been cancelled, so it's too late to add free months. A credit can be given in Stripe instead.");
  await db.$transaction(async (tx) => {
    await tx.billingIntent.update({ where: { id }, data: { trialMonths: months, promoLabel: months > 0 ? (label.trim().slice(0, 60) || "Special offer") : null } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "billing.offer_set", targetType: "billing_intent", targetId: id, customerId: b.customerId, visibility: "client", detail: { months, label } });
  });
}

/** Customer rang to cancel: stop the monthly plan in Stripe at the end of the month they've paid for, and record it. */
export async function cancelPlan(ctx: StaffCtx, id: string) {
  needWrite(ctx);
  const b = await db.billingIntent.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!b) throw notFound();
  if (!isMonthly(b.kind) || !b.stripeSubscriptionId || !["active", "past_due"].includes(b.status)) throw new DomainError("conflict", "There's no running monthly plan to cancel here.");
  if (b.cancelsAt) throw new DomainError("conflict", "This plan is already set to end.");
  const sub = await stripe<{ cancel_at?: number | null; current_period_end?: number }>(`/subscriptions/${b.stripeSubscriptionId}`, { cancel_at_period_end: true });
  const ends = new Date(((sub.cancel_at ?? sub.current_period_end) ?? Math.floor(Date.now() / 1000)) * 1000);
  await db.$transaction(async (tx) => {
    await tx.billingIntent.update({ where: { id }, data: { cancelsAt: ends } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "billing.plan_cancel_requested", targetType: "billing_intent", targetId: id, customerId: b.customerId, visibility: "client", detail: { ends: ends.toISOString() } });
  });
  return ends;
}

/** Split the website fee into a deposit and a final payment. Only before anything is paid. */
export async function splitWebsiteFee(ctx: StaffCtx, contractId: string, depositPercent: number) {
  needWrite(ctx);
  if (!(depositPercent >= 5 && depositPercent <= 95)) throw new DomainError("validation", "Pick a deposit between 5% and 95%.");
  const one = await db.billingIntent.findFirst({ where: { workspaceId: ctx.workspaceId, contractId, kind: "one_off" } });
  if (!one) throw new DomainError("conflict", "This order has no website fee to split.");
  if (one.status !== "pending") throw new DomainError("conflict", "The website fee has already been paid or cancelled.");
  const dep = Math.round((one.amountMinor * depositPercent) / 100);
  await db.$transaction(async (tx) => {
    await tx.billingIntent.delete({ where: { id: one.id } });
    await tx.billingIntent.createMany({ data: [
      { workspaceId: one.workspaceId, customerId: one.customerId, contractId, kind: "deposit", amountMinor: dep, currency: one.currency, description: `Website deposit (${depositPercent}%)` },
      { workspaceId: one.workspaceId, customerId: one.customerId, contractId, kind: "balance", amountMinor: one.amountMinor - dep, currency: one.currency, description: "Website final payment" },
    ] });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "billing.split", targetType: "contract", targetId: contractId, customerId: one.customerId, detail: { depositPercent } });
  });
}

// ───────── Stripe tells us what happened ─────────
type Obj = Record<string, unknown> & { id?: string; metadata?: Record<string, string>; subscription?: string | null; payment_intent?: string | null; status?: string };

/** Applies a verified Stripe event. Safe to run twice. */
export async function applyStripeEvent(type: string, o: Obj, workspaceId: string) {
  const intentId = o.metadata?.intentId;
  const who = { email: ((o as { customer_details?: { email?: string } }).customer_details?.email ?? (o as { customer_email?: string }).customer_email) || null, name: (o as { customer_details?: { name?: string } }).customer_details?.name || null };
  const record = (b: Mailable, action: string, event: "paid" | "plan_started" | "failed" | "cancelled", hint = who, key = "", rc?: { key: string; method: "card" | "bank" | "other"; stripeRef?: string | null }, trialEndsAt?: Date | null) =>
    db.$transaction(async (tx) => { await audit(tx, { workspaceId, actor: null, action, targetType: "billing_intent", targetId: b.id, customerId: b.customerId, visibility: "client", detail: { amountMinor: b.amountMinor, ...(trialEndsAt ? { freeUntil: trialEndsAt.toISOString() } : {}) } }); await payEmails(tx, b, event, hint, key, rc, trialEndsAt); });
  if (type === "checkout.session.completed" && intentId) {
    const b = await db.billingIntent.findFirst({ where: { id: intentId, workspaceId } });
    if (!b) return;
    const paid = (o as { payment_status?: string }).payment_status === "paid" || !!stripeSubId(o);
    if (!paid) return; // delayed payment methods report later
    const monthly = isMonthly(b.kind);
    if (b.status === (monthly ? "active" : "paid")) return;
    const trialEndsAt = monthly && b.trialMonths > 0 ? addMonths(new Date(), b.trialMonths) : null;
    await db.billingIntent.update({ where: { id: b.id }, data: { status: monthly ? "active" : "paid", paidAt: new Date(), paidVia: "stripe", stripeSubscriptionId: stripeSubId(o) ?? null, stripePaymentIntent: (o.payment_intent as string) ?? null, ...(trialEndsAt ? { trialEndsAt } : {}) } });
    if (b.ticketId) await db.ticket.update({ where: { id: b.ticketId }, data: { chargeStatus: "paid" } });
    await record(b, monthly ? "billing.plan_started" : "billing.paid", monthly ? "plan_started" : "paid", who, "", trialEndsAt ? undefined : { key: `cs:${o.id}`, method: "card", stripeRef: (o.payment_intent as string) ?? null }, trialEndsAt);
    return;
  }
  const sub = type.startsWith("customer.subscription.") ? o.id : type.startsWith("invoice.") ? stripeSubId(o) : undefined;
  if (!sub) return;
  const b = await db.billingIntent.findFirst({ where: { workspaceId, stripeSubscriptionId: sub } });
  if (!b) return;
  if (type === "customer.subscription.updated") {
    const at = (o as { cancel_at?: number | null; cancel_at_period_end?: boolean }).cancel_at;
    const cancelling = (o as { cancel_at_period_end?: boolean }).cancel_at_period_end || !!at;
    const when = cancelling ? new Date(((at ?? (o as { current_period_end?: number }).current_period_end ?? 0) as number) * 1000) : null;
    if ((when?.getTime() ?? 0) !== (b.cancelsAt?.getTime() ?? 0)) {
      await db.billingIntent.update({ where: { id: b.id }, data: { cancelsAt: when && when.getTime() > 0 ? when : null } });
      await db.$transaction((tx) => audit(tx, { workspaceId, actor: null, action: cancelling ? "billing.plan_cancel_scheduled" : "billing.plan_cancel_withdrawn", targetType: "billing_intent", targetId: b.id, customerId: b.customerId, visibility: "client", detail: { ends: when?.toISOString() } }));
    }
  }
  const next = type === "invoice.payment_failed" ? "past_due" : type === "invoice.paid" ? "active" : type === "customer.subscription.deleted" ? "cancelled"
    : type === "customer.subscription.updated" ? ({ active: "active", trialing: "active", past_due: "past_due", unpaid: "past_due", canceled: "cancelled" } as Record<string, string>)[o.status ?? ""] : undefined;
  if (type === "invoice.paid" && (o as { billing_reason?: string }).billing_reason !== "subscription_create" && o.id) {
    const inv = o as { id: string; amount_paid?: number; status_transitions?: { paid_at?: number } };
    await db.$transaction((tx) => ensureReceipt(tx, b, { key: `in:${inv.id}`, method: "card", stripeRef: inv.id, amountMinor: inv.amount_paid || b.amountMinor, paidAt: inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000) : new Date() }));
  }
  if (!next || next === b.status) return;
  await db.billingIntent.update({ where: { id: b.id }, data: { status: next } });
  // Each failed attempt is a new email; coming back to active after a failure is good news but Stripe's receipt covers it.
  if (next === "past_due") await record(b, "billing.plan_past_due", "failed", who, `:${o.id ?? ""}`);
  else if (next === "cancelled") await record(b, "billing.plan_cancelled", "cancelled");
  else await db.$transaction((tx) => audit(tx, { workspaceId, actor: null, action: `billing.plan_${next}`, targetType: "billing_intent", targetId: b.id, customerId: b.customerId, visibility: "client", detail: { amountMinor: b.amountMinor } }));
}
