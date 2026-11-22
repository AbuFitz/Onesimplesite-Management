import { requireClient } from "@/modules/identity/session";
import { levelLabel } from "@/modules/portal/access";
export const metadata = { title: "Your companies" };
export default async function Companies() {
  const c = await requireClient();
  return (
    <section className="acc-page"><h1>{c.memberships.length > 1 ? "Your companies" : "Your company"}</h1>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-white px-4">{c.memberships.map((m) => <li key={m.customerId} className="flex items-center justify-between gap-3 py-3"><span className="font-semibold">{m.customer.displayName}</span><span className="rounded-full bg-bone px-3 py-1 text-sm font-bold">{levelLabel(m.role)}{m.billing && m.role !== "admin" ? " + billing" : ""}</span></li>)}</ul>
      <p className="mt-3 text-sm text-muted">Your access level decides what you can do. The company owner can ask us to change it.</p>
    </section>
  );
}
