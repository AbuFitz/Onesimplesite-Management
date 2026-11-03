import Link from "next/link";
import { redirect } from "next/navigation";
import { clientCanAny, memberCan } from "@/modules/portal/access";
import { requireClient } from "@/modules/identity/session";
import { clientOverview } from "@/modules/portal/service";
import { db } from "@/lib/db";
import { TicketForm } from "@/components/ticket-form";

export const metadata = { title: "Raise a ticket" };

export default async function NewTicket() {
  const c = await requireClient();
  if (!clientCanAny(c, "tickets")) redirect("/help");
  const ids = c.memberships.filter((m) => memberCan(m, "tickets")).map((m) => m.customerId);
  const [o, accounts] = await Promise.all([clientOverview(c), db.customer.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true } })]);
  const cust = new Map(accounts.map((a) => [a.id, a.displayName]));
  return (
    <div className="space-y-4">
      <Link href="/help" className="text-sm font-semibold underline">Back to help</Link>
      <section className="tile bg-white !p-6 sm:!p-10">
        <h1 className="mb-8 text-4xl sm:text-5xl">Raise a ticket</h1>
        <TicketForm accounts={ids.map((id) => ({ id, name: cust.get(id) ?? "Your business" }))} projects={o.projects.map((p) => ({ id: p.id, name: p.name, customerId: "" }))} />
      </section>
    </div>
  );
}
