import { CreditCard, CheckCircle2, Receipt as ReceiptIcon, Download } from "lucide-react";
import { clientReceipts } from "@/modules/billing/receipt";
import { redirect } from "next/navigation";
import { clientCanAny } from "@/modules/portal/access";
import { requireClient } from "@/modules/identity/session";
import { clientBilling, chargeOf, money, KIND_LABEL, isMonthly, plainStatus, isScheduled, scheduledLabel } from "@/modules/billing/service";
import { payAction, manageBillingAction } from "@/app/actions/billing";
import { fmtDate } from "@/components/ui";

export const metadata = { title: "Billing" };
const TONE = { due: "bg-butter text-[#5c4700]", ok: "bg-mint text-[#0a5a3d]", warn: "bg-blush text-[#7a2e12]", off: "bg-black/[.06] text-ink-2" } as const;

export default async function Billing({ searchParams }: { searchParams: Promise<{ paid?: string; error?: string }> }) {
  const c = await requireClient();
  if (!clientCanAny(c, "billing")) redirect("/overview");
  const sp = await searchParams;
  const [all, receipts] = await Promise.all([clientBilling(c), clientReceipts(c)]);
  const items = all.filter((b) => b.status !== "cancelled");          // an order that was called off is not shown as something to pay
  const due = items.filter((b) => !isMonthly(b.kind) && b.status === "pending" && !isScheduled(b));
  const later = items.filter((b) => isScheduled(b) && b.kind === "balance");
  const monthly = items.filter((b) => isMonthly(b.kind) && b.status !== "cancelled");
  const total = due.reduce((n, b) => n + b.amountMinor, 0);
  // The payment journey of the order, as a flow: deposit (or the whole fee) -> final payment -> care plan. Change requests are separate, below.
  type Step = { key: string; title: string; amount: string; state: "paid" | "due" | "next" | "free" | "active" | "later"; note: string };
  const order = items.filter((b) => b.kind !== "change");
  const stage = (b: (typeof items)[number] | undefined, title: string, fallbackNote: string): Step | null => {
    if (!b) return null;
    const monthly = isMonthly(b.kind), wait = isScheduled(b);
    const st = b.paidVia === "free" ? "free" : b.status === "paid" ? "paid" : monthly && b.status === "active" ? "active" : wait ? "later" : b.status === "pending" || b.status === "past_due" ? "due" : "later";
    const note = st === "paid" ? (b.paidAt ? `Paid ${fmtDate(b.paidAt)}` : "Paid") : st === "free" ? (b.trialEndsAt ? `Free until ${fmtDate(b.trialEndsAt)}` : `${b.trialMonths} month${b.trialMonths === 1 ? "" : "s"} free`) : st === "active" ? "Running" : st === "due" ? (b.status === "past_due" ? "Payment failed" : "Ready to pay") : fallbackNote;
    return { key: b.id, title, amount: b.paidVia === "free" ? "Free" : `${money(b.amountMinor, b.currency)}${monthly ? " / month" : ""}`, state: st, note };
  };
  // One flow per order, so two orders never get mixed into one picture. Newest orders first; the rest are in the lists below.
  const orders = new Map<string, typeof order>();
  for (const b of order) { const k = chargeOf(b).reference; orders.set(k, [...(orders.get(k) ?? []), b]); }
  const journeys = [...orders.entries()].map(([ref, list]) => {
    const kind = (k: string[]) => list.find((b) => k.includes(b.kind));
    const steps = [stage(kind(["deposit", "one_off"]), kind(["deposit"]) ? "Deposit" : "Website", "Comes first"), stage(kind(["balance"]), "Final payment", "When your site is ready"), stage(kind(["recurring_setup"]), "Care plan", "Starts when you go live")].filter((x): x is Step => !!x);
    return { ref, title: chargeOf(list[0]).title, steps, open: steps.some((x) => x.state === "due" || x.state === "later") };
  }).filter((j) => j.steps.length > 1).sort((x, y) => Number(y.open) - Number(x.open)).slice(0, 2);
  const nextDue = due[0];
  const rows = (list: typeof items) => list.length <= 5 ? rowsOf(list) : (
    <>{rowsOf(list.slice(0, 5))}<details className="more"><summary>Show {list.length - 5} more</summary>{rowsOf(list.slice(5))}</details></>
  );
  const rowsOf = (list: typeof items) => (
    <ul className="chg-list">
      {list.map((b) => { const wait = isScheduled(b); const s = wait ? { label: scheduledLabel(b), tone: "off" as const } : plainStatus(b.kind, b.status, b.cancelsAt, b.trialEndsAt, b.paidVia === "free"); const canPay = !wait && (b.status === "pending" || b.status === "past_due"); return (
        <li key={b.id} className="chg">
          <div className="chg-main">
            <p className="font-semibold">{b.description ?? KIND_LABEL[b.kind] ?? "Payment"}</p>
            <p className="text-[13px] text-muted">{chargeOf(b).title} · {chargeOf(b).reference}{b.paidAt ? ` · ${isMonthly(b.kind) ? "started" : "paid"} ${fmtDate(b.paidAt)}` : ""}</p>
            {b.paidVia === "free" && <p className="chg-offer">{b.promoLabel ?? "Offer"}: {b.trialMonths} month{b.trialMonths === 1 ? "" : "s"} free, no card needed. {!b.trialEndsAt ? "It starts on the day your website goes live." : ""}</p>}
            {isMonthly(b.kind) && b.trialMonths > 0 && b.paidVia !== "free" && b.status !== "cancelled" && <p className="chg-offer">{b.promoLabel ?? "Offer"}: {b.trialMonths} month{b.trialMonths === 1 ? "" : "s"} free{b.trialEndsAt ? ` · first payment ${fmtDate(b.trialEndsAt)}` : ""}</p>}
            {!isMonthly(b.kind) && b.promoLabel && <p className="chg-offer">{b.promoLabel} applied</p>}
          </div>
          <p className="chg-amt num">{b.paidVia === "free" ? "Free" : money(b.amountMinor, b.currency)}{isMonthly(b.kind) && b.paidVia !== "free" && <span> / month</span>}</p>
          <div className="chg-foot">
            <span className={`chg-status ${TONE[s.tone]}`}>{s.label}</span>
            {wait && <p className="chg-note">{b.kind === "balance" ? "We'll ask for this when your site is ready to go live." : "We'll email you when your site is live."}</p>}
            {canPay && b.status === "pending" && <form action={payAction} className="ml-auto"><input type="hidden" name="id" value={b.id} /><button className="btn"><CreditCard size={16} aria-hidden /> {isMonthly(b.kind) ? "Start plan" : "Pay now"}</button></form>}
            {canPay && b.status === "past_due" && <form action={payAction} className="ml-auto"><input type="hidden" name="id" value={b.id} /><button className="btn"><CreditCard size={16} aria-hidden /> Update payment</button></form>}
          </div>
        </li>); })}
    </ul>
  );
  const changes = items.filter((b) => b.kind === "change");
  const paidList = order.filter((b) => b.status === "paid");
  return (
    <div className="bill">
      {sp.paid && <div role="status" className="tile flex items-center gap-3 bg-mint !p-5"><CheckCircle2 aria-hidden /><p className="font-semibold">Thank you. Your payment is being confirmed and will show as Paid in a moment. Stripe emails you a receipt.</p></div>}
      {sp.error && <div role="alert" className="tile bg-blush !p-5 font-semibold">{sp.error}</div>}

      <section className="bill-hero" aria-labelledby="bh">
        <div className="bill-hero-in">
          <p className="bill-eye" id="bh">Billing</p>
          {total > 0 ? (<>
            <p className="bill-big num">{money(total)}</p>
            <p className="bill-sub">{due.length === 1 ? `to pay now: ${due[0].description ?? KIND_LABEL[due[0].kind] ?? "a payment"}` : `to pay now across ${due.length} payments`}. You pay by card on a secure payment page.</p>
            {nextDue && due.length === 1 && <form action={payAction} className="mt-5"><input type="hidden" name="id" value={nextDue.id} /><button className="bill-pay"><CreditCard size={18} aria-hidden /> {isMonthly(nextDue.kind) ? "Start plan" : `Pay ${money(nextDue.amountMinor, nextDue.currency)}`}</button></form>}
            {due.length > 1 && <a href="#owed" className="bill-pay">See what is due</a>}
          </>) : (<>
            <p className="bill-big">All paid up</p>
            <p className="bill-sub">{later.length ? `Nothing to pay right now. Your final payment of ${money(later.reduce((n, b) => n + b.amountMinor, 0))} comes when your site is ready to go live.` : "Nothing to pay right now."}</p>
          </>)}
        </div>
      </section>

      {journeys.map((j) => (
        <section key={j.ref} className="bill-flow card p-5 sm:p-6" aria-label={`Payments for ${j.title}`}>
          <h2 className="text-xl font-medium tracking-tight">{j.title}</h2>
          <p className="text-[13px] text-muted">{j.ref} · your payments, step by step</p>
          <ol className="flow">
            {j.steps.map((x, n) => (
              <li key={x.key} className={`flow-s ${x.state} ${n === j.steps.findIndex((y) => y.state === "due" || y.state === "later") ? "here" : ""}`}>
                <span className="flow-dot" aria-hidden>{x.state === "paid" || x.state === "free" || x.state === "active" ? <CheckCircle2 size={18} /> : n + 1}</span>
                <div className="flow-card"><b>{x.title}</b><span className="num">{x.amount}</span><small>{x.note}</small></div>
              </li>
            ))}
          </ol>
        </section>
      ))}

      {due.length > 0 && <section id="owed" className="card p-5 sm:p-6" aria-label="To pay now"><h2 className="mb-3 text-xl font-medium tracking-tight">To pay now</h2>{rows(due)}</section>}
      {monthly.length > 0 && <section className="card p-5 sm:p-6" aria-label="Your care plan"><h2 className="mb-3 text-xl font-medium tracking-tight">Your care plan</h2>{rows(monthly)}</section>}
      {later.length > 0 && <section className="card p-5 sm:p-6" aria-label="Coming up"><h2 className="mb-3 text-xl font-medium tracking-tight">Coming up</h2>{rows(later)}</section>}
      {changes.length > 0 && <section className="card p-5 sm:p-6" aria-label="Changes you asked for"><h2 className="mb-3 text-xl font-medium tracking-tight">Changes you asked for</h2>{rows(changes)}</section>}
      {paidList.length > 0 && due.length === 0 && monthly.length === 0 && later.length === 0 && changes.length === 0 && <section className="card p-5 sm:p-6">{rows(paidList)}</section>}

      <section className="card p-5 sm:p-6" aria-labelledby="rc"><h2 id="rc" className="flex items-center gap-2 text-xl font-medium tracking-tight"><ReceiptIcon size={20} aria-hidden /> Your receipts</h2>
        {receipts.length === 0 ? <p className="mt-2 text-muted">When you pay, your receipt appears here straight away. We email you a copy too.</p> : (
          <ul className="rcp">{receipts.slice(0, 6).map((r) => (
            <li key={r.id}>
              <div className="min-w-0"><p className="rcp-t">{r.description}</p><p className="rcp-m">{r.ref} · {fmtDate(r.paidAt)} · {r.method === "card" ? "Card" : r.method === "bank" ? "Bank transfer" : "Other"}</p></div>
              <p className="rcp-a num">{money(r.amountMinor, r.currency)}</p>
              <a href={`/billing/receipt/${r.id}`} className="rcp-dl" download aria-label={`Download receipt ${r.ref} as a PDF`}><Download size={16} aria-hidden /> PDF</a>
            </li>))}</ul>
        )}
        {receipts.length > 6 && <details className="more"><summary>Show {receipts.length - 6} older receipts</summary><ul className="rcp">{receipts.slice(6).map((r) => (
          <li key={r.id}><div className="min-w-0"><p className="rcp-t">{r.description}</p><p className="rcp-m">{r.ref} · {fmtDate(r.paidAt)}</p></div><p className="rcp-a num">{money(r.amountMinor, r.currency)}</p><a href={`/billing/receipt/${r.id}`} className="rcp-dl" download aria-label={`Download receipt ${r.ref} as a PDF`}><Download size={16} aria-hidden /> PDF</a></li>))}</ul></details>}
      </section>
      {monthly.some((b) => b.status !== "pending" && b.paidVia !== "free") && (
        <section className="tile bg-white"><h2 className="text-xl font-medium tracking-tight">Manage your card</h2><p className="mt-1 text-muted">Update your card, see receipts, or cancel on Stripe's secure page.</p>
          <form action={manageBillingAction} className="mt-4"><button className="btn btn-quiet">Manage card and receipts</button></form></section>
      )}
    </div>
  );
}
