import { CreditCard, CheckCircle2, Receipt as ReceiptIcon, Download } from "lucide-react";
import { clientReceipts } from "@/modules/billing/receipt";
import { redirect } from "next/navigation";
import { clientCanAny } from "@/modules/portal/access";
import { requireClient } from "@/modules/identity/session";
import { clientBilling, chargeOf, money, KIND_LABEL, isMonthly, plainStatus, isScheduled } from "@/modules/billing/service";
import { payAction, manageBillingAction } from "@/app/actions/billing";
import { fmtDate } from "@/components/ui";

export const metadata = { title: "Billing" };
const TONE = { due: "bg-butter text-[#5c4700]", ok: "bg-mint text-[#0a5a3d]", warn: "bg-blush text-[#7a2e12]", off: "bg-bone text-muted" } as const;

export default async function Billing({ searchParams }: { searchParams: Promise<{ paid?: string; error?: string }> }) {
  const c = await requireClient();
  if (!clientCanAny(c, "billing")) redirect("/overview");
  const sp = await searchParams;
  const [items, receipts] = await Promise.all([clientBilling(c), clientReceipts(c)]);
  const due = items.filter((b) => !isMonthly(b.kind) && b.status === "pending" && !isScheduled(b));
  const later = items.filter(isScheduled);
  const monthly = items.filter((b) => isMonthly(b.kind) && b.status !== "cancelled");
  const total = due.reduce((n, b) => n + b.amountMinor, 0);
  return (
    <div className="space-y-4">
      {sp.paid && <div role="status" className="tile flex items-center gap-3 bg-mint !p-5"><CheckCircle2 aria-hidden /><p className="font-semibold">Thank you. Your payment is being confirmed and will show as Paid in a moment. Stripe emails you a receipt.</p></div>}
      {sp.error && <div role="alert" className="tile bg-blush !p-5 font-semibold">{sp.error}</div>}
      <section className="tile bg-lilac !p-7 sm:!p-10">
        <h1 className="text-4xl sm:text-5xl">Billing</h1>
        <p className="mt-3 max-w-xl text-lg font-medium">{total > 0 ? `${money(total)} to pay. You can pay by card on a secure payment page.` : later.length ? `Nothing to pay right now. Your final payment of ${money(later.reduce((n, b) => n + b.amountMinor, 0))} is due before your website launches, and we'll email you when it's ready.` : items.length ? "You're all paid up." : "Nothing to pay yet. Your payments appear here once you've signed your order."}</p>
      </section>
      {items.length > 0 && (
        <section className="tile bg-white" aria-label="Payments">
          <ul className="divide-y divide-line">
            {items.map((b) => { const wait = isScheduled(b); const s = wait ? { label: "Due before launch", tone: "off" as const } : plainStatus(b.kind, b.status, b.cancelsAt, b.trialEndsAt, b.paidVia === "free"); const canPay = !wait && (b.status === "pending" || b.status === "past_due"); return (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div><p className="font-bold">{b.description ?? KIND_LABEL[b.kind] ?? "Payment"}</p><p className="text-sm text-muted">{chargeOf(b).title} · {chargeOf(b).reference}{b.paidAt ? ` · ${isMonthly(b.kind) ? "started" : "paid"} ${fmtDate(b.paidAt)}` : ""}</p>{isMonthly(b.kind) && b.trialMonths > 0 && b.status !== "cancelled" && <p className="mt-1 inline-block rounded-lg bg-mint px-2.5 py-1 text-sm font-semibold">{b.promoLabel ?? "Offer"}: {b.trialMonths} month{b.trialMonths === 1 ? "" : "s"} free{b.trialEndsAt ? ` · first payment ${fmtDate(b.trialEndsAt)}` : " from the day you start"}</p>}{!isMonthly(b.kind) && b.promoLabel && <p className="mt-1 inline-block rounded-lg bg-mint px-2.5 py-1 text-sm font-semibold">{b.promoLabel} applied</p>}</div>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-bold">{money(b.amountMinor, b.currency)}{isMonthly(b.kind) && <span className="text-sm font-medium text-muted"> / month</span>}</p>
                  <span className={`rounded-full px-3 py-1 text-sm font-bold ${TONE[s.tone]}`}>{s.label}</span>
                  {wait && <p className="basis-full text-sm text-muted sm:basis-auto">We'll ask for this when your site is ready to go live.</p>}
                  {canPay && b.status === "pending" && <form action={payAction}><input type="hidden" name="id" value={b.id} /><button className="btn btn-dark"><CreditCard size={16} aria-hidden /> {isMonthly(b.kind) ? "Start plan" : "Pay now"}</button></form>}
                </div>
              </li>
            ); })}
          </ul>
        </section>
      )}
      <section className="tile bg-white" aria-labelledby="rc"><h2 id="rc" className="flex items-center gap-2 text-2xl"><ReceiptIcon size={22} aria-hidden /> Your receipts</h2>
        {receipts.length === 0 ? <p className="mt-2 text-muted">When you pay, your receipt appears here straight away. We email you a copy too.</p> : (
          <ul className="mt-3 divide-y divide-line">{receipts.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0"><p className="font-bold">{r.description}</p><p className="text-sm text-muted">{r.ref} · {fmtDate(r.paidAt)} · {r.method === "card" ? "Card" : r.method === "bank" ? "Bank transfer" : "Other"}</p></div>
              <div className="flex items-center gap-3"><p className="text-lg font-bold">{money(r.amountMinor, r.currency)}</p><a href={`/billing/receipt/${r.id}`} className="btn btn-quiet" download><Download size={15} aria-hidden /> PDF</a></div>
            </li>))}</ul>
        )}
      </section>
      {monthly.some((b) => b.status !== "pending" && b.paidVia !== "free") && (
        <section className="tile bg-white"><h2 className="text-2xl">Your monthly plan</h2><p className="mt-1 text-muted">Update your card, see receipts, or cancel on Stripe's secure page.</p>
          <form action={manageBillingAction} className="mt-4"><button className="btn btn-quiet">Manage card and receipts</button></form></section>
      )}
    </div>
  );
}
