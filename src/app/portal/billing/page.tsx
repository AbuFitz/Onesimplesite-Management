import { CreditCard, CheckCircle2 } from "lucide-react";
import { requireClient } from "@/modules/identity/session";
import { clientBilling, money, KIND_LABEL, isMonthly, plainStatus } from "@/modules/billing/service";
import { payAction, manageBillingAction } from "@/app/actions/billing";
import { fmtDate } from "@/components/ui";

export const metadata = { title: "Billing" };
const TONE = { due: "bg-butter text-[#5c4700]", ok: "bg-mint text-[#0a5a3d]", warn: "bg-blush text-[#7a2e12]", off: "bg-bone text-muted" } as const;

export default async function Billing({ searchParams }: { searchParams: Promise<{ paid?: string; error?: string }> }) {
  const c = await requireClient();
  const sp = await searchParams;
  const items = await clientBilling(c);
  const due = items.filter((b) => !isMonthly(b.kind) && b.status === "pending");
  const monthly = items.filter((b) => isMonthly(b.kind) && b.status !== "cancelled");
  const total = due.reduce((n, b) => n + b.amountMinor, 0);
  return (
    <div className="space-y-4">
      {sp.paid && <div role="status" className="tile flex items-center gap-3 bg-mint !p-5"><CheckCircle2 aria-hidden /><p className="font-semibold">Thank you. Your payment is being confirmed and will show as Paid in a moment. Stripe emails you a receipt.</p></div>}
      {sp.error && <div role="alert" className="tile bg-blush !p-5 font-semibold">{sp.error}</div>}
      <section className="tile bg-lilac !p-7 sm:!p-10">
        <h1 className="text-4xl sm:text-5xl">Billing</h1>
        <p className="mt-3 max-w-xl text-lg font-medium">{total > 0 ? `${money(total)} to pay. You can pay by card, securely through Stripe.` : items.length ? "You're all paid up." : "Nothing to pay yet. Your payments appear here once you've signed your order."}</p>
      </section>
      {items.length > 0 && (
        <section className="tile bg-white" aria-label="Payments">
          <ul className="divide-y divide-line">
            {items.map((b) => { const s = plainStatus(b.kind, b.status); const canPay = b.status === "pending" || b.status === "past_due"; return (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div><p className="font-bold">{b.description ?? KIND_LABEL[b.kind] ?? "Payment"}</p><p className="text-sm text-muted">{b.contract.title} · {b.contract.reference}{b.paidAt ? ` · paid ${fmtDate(b.paidAt)}` : ""}</p></div>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-bold">{money(b.amountMinor, b.currency)}{isMonthly(b.kind) && <span className="text-sm font-medium text-muted"> / month</span>}</p>
                  <span className={`rounded-full px-3 py-1 text-sm font-bold ${TONE[s.tone]}`}>{s.label}</span>
                  {canPay && b.status === "pending" && <form action={payAction}><input type="hidden" name="id" value={b.id} /><button className="btn btn-dark"><CreditCard size={16} aria-hidden /> {isMonthly(b.kind) ? "Start plan" : "Pay now"}</button></form>}
                </div>
              </li>
            ); })}
          </ul>
        </section>
      )}
      {monthly.some((b) => b.status !== "pending") && (
        <section className="tile bg-white"><h2 className="text-2xl">Your monthly plan</h2><p className="mt-1 text-muted">Update your card, see receipts, or cancel on Stripe's secure page.</p>
          <form action={manageBillingAction} className="mt-4"><button className="btn btn-quiet">Manage card and receipts</button></form></section>
      )}
    </div>
  );
}
