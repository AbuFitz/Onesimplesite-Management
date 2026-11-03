import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { DomainError, forbidden, notFound } from "@/lib/errors";
import { portalLink } from "@/lib/env";
import { stripe, stripeReady } from "@/lib/stripe";
import { can } from "@/modules/identity/permissions";
import type { StaffCtx } from "@/modules/identity/session";
import type { ClientCtx } from "@/modules/portal/service";

export const money = (minor: number, cur = "GBP") => new Intl.NumberFormat("en-GB", { style: "currency", currency: cur }).format(minor / 100);

/** What each kind of charge is called, in plain words. */
export const KIND_LABEL: Record<string, string> = { one_off: "Website", deposit: "Deposit", balance: "Final payment", recurring_setup: "Monthly plan" };
export const isMonthly = (kind: string) => kind === "recurring_setup";

/** Status in plain words. */
export function plainStatus(kind: string, status: string): { label: string; tone: "due" | "ok" | "warn" | "off" } {
  if (status === "paid") return { label: "Paid", tone: "ok" };
  if (status === "active") return { label: "Active", tone: "ok" };
  if (status === "past_due") return { label: "Payment failed", tone: "warn" };
  if (status === "cancelled") return { label: "Cancelled", tone: "off" };
  return { label: isMonthly(kind) ? "Not started" : "Due", tone: "due" };
}

const clientScope = (c: ClientCtx) => ({ customerId: { in: c.memberships.map((m) => m.customerId) } });
const include = { contract: { select: { title: true, reference: true, status: true } } } as const;

/** Only signed-and-completed orders bill. */
export const clientBilling = (c: ClientCtx) =>
  db.billingIntent.findMany({ where: { ...clientScope(c), contract: { status: "completed" } }, orderBy: { createdAt: "asc" }, include });

async function stripeCustomer(customerId: string, email: string | undefined, name: string) {
  const cu = await db.customer.findUniqueOrThrow({ where: { id: customerId }, select: { stripeCustomerId: true, displayName: true, reference: true } });
  if (cu.stripeCustomerId) return cu.stripeCustomerId;
  const made = await stripe<{ id: string }>("/customers", { name: cu.displayName, email: email || undefined, metadata: { customerId, reference: cu.reference, contact: name } }, { idempotencyKey: `cust:${customerId}` });
  await db.customer.updateMany({ where: { id: customerId, stripeCustomerId: null }, data: { stripeCustomerId: made.id } });
  return (await db.customer.findUniqueOrThrow({ where: { id: customerId }, select: { stripeCustomerId: true } })).stripeCustomerId!;
}

/** Starts a secure Stripe checkout for one charge and returns its page address. */
export async function startPayment(c: ClientCtx, intentId: string): Promise<string> {
  if (!stripeReady()) throw new DomainError("conflict", "Card payments aren't switched on yet. Please contact us and we'll send you the details.");
  const b = await db.billingIntent.findFirst({ where: { id: intentId, ...clientScope(c), contract: { status: "completed" } }, include });
  if (!b) throw notFound();
  if (b.status === "paid" || b.status === "active") throw new DomainError("conflict", "This one is already paid.");
  if (b.status === "cancelled") throw new DomainError("conflict", "This charge was cancelled. Please contact us.");
  const monthly = isMonthly(b.kind);
  const customer = await stripeCustomer(b.customerId, c.email || undefined, c.name ?? "");
  const line = { quantity: 1, price_data: { currency: b.currency.toLowerCase(), unit_amount: b.amountMinor, product_data: { name: `${b.description ?? KIND_LABEL[b.kind] ?? "OneSimpleSite"} (${b.contract.reference})` }, ...(monthly ? { recurring: { interval: "month" } } : {}) } };
  const s = await stripe<{ id: string; url: string }>("/checkout/sessions", {
    mode: monthly ? "subscription" : "payment", customer, line_items: [line],
    success_url: portalLink("/billing?paid=1"), cancel_url: portalLink("/billing"),
    client_reference_id: b.id, metadata: { intentId: b.id, contract: b.contract.reference },
    ...(monthly ? { subscription_data: { metadata: { intentId: b.id } } } : { payment_intent_data: { metadata: { intentId: b.id }, description: `${b.contract.reference} ${KIND_LABEL[b.kind] ?? ""}` } }),
  });
  await db.billingIntent.update({ where: { id: b.id }, data: { stripeSessionId: s.id } });
  return s.url;
}

/** Stripe's own page where a customer updates their card or cancels the monthly plan. */
export async function openBillingPortal(c: ClientCtx): Promise<string> {
  if (!stripeReady()) throw new DomainError("conflict", "Card payments aren't switched on yet.");
  const cu = await db.customer.findFirst({ where: { id: { in: c.memberships.map((m) => m.customerId) }, stripeCustomerId: { not: null } }, select: { stripeCustomerId: true } });
  if (!cu?.stripeCustomerId) throw new DomainError("conflict", "There's nothing to manage yet. It appears after your first payment.");
  const s = await stripe<{ url: string }>("/billing_portal/sessions", { customer: cu.stripeCustomerId, return_url: portalLink("/billing") });
  return s.url;
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
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "billing.paid_manually", targetType: "billing_intent", targetId: id, customerId: b.customerId, detail: { via, amountMinor: b.amountMinor } });
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
  const log = (b: { id: string; customerId: string; amountMinor: number }, action: string) => db.$transaction((tx) => audit(tx, { workspaceId, actor: null, action, targetType: "billing_intent", targetId: b.id, customerId: b.customerId, visibility: "client", detail: { amountMinor: b.amountMinor } }));
  if (type === "checkout.session.completed" && intentId) {
    const b = await db.billingIntent.findFirst({ where: { id: intentId, workspaceId } });
    if (!b) return;
    const paid = (o as { payment_status?: string }).payment_status === "paid" || !!o.subscription;
    if (!paid) return; // delayed payment methods report later
    const monthly = isMonthly(b.kind);
    if (b.status === (monthly ? "active" : "paid")) return;
    await db.billingIntent.update({ where: { id: b.id }, data: { status: monthly ? "active" : "paid", paidAt: new Date(), paidVia: "stripe", stripeSubscriptionId: (o.subscription as string) ?? null, stripePaymentIntent: (o.payment_intent as string) ?? null } });
    await log(b, monthly ? "billing.plan_started" : "billing.paid");
    return;
  }
  const sub = (type.startsWith("customer.subscription.") ? o.id : type.startsWith("invoice.") ? (o.subscription as string | null) : null) ?? undefined;
  if (!sub) return;
  const b = await db.billingIntent.findFirst({ where: { workspaceId, stripeSubscriptionId: sub } });
  if (!b) return;
  const next = type === "invoice.payment_failed" ? "past_due" : type === "invoice.paid" ? "active" : type === "customer.subscription.deleted" ? "cancelled"
    : type === "customer.subscription.updated" ? ({ active: "active", trialing: "active", past_due: "past_due", unpaid: "past_due", canceled: "cancelled" } as Record<string, string>)[o.status ?? ""] : undefined;
  if (!next || next === b.status) return;
  await db.billingIntent.update({ where: { id: b.id }, data: { status: next } });
  await log(b, `billing.plan_${next}`);
}
