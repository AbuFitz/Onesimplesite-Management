import { redirect } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { requireClient } from "@/modules/identity/session";
import { clientPeople } from "@/modules/people/service";
import { memberCan, levelLabel } from "@/modules/portal/access";
import { RequestAccessForm } from "@/components/request-access-form";
import { Avatar, timeAgo } from "@/components/ui";

export const metadata = { title: "People" };

export default async function People({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const c = await requireClient();
  const sp = await searchParams;
  const m = c.memberships.find((x) => memberCan(x, "people"));
  if (!m) redirect("/overview");
  const { people, pending } = await clientPeople(c, m.customerId);
  return (
    <div className="space-y-4">
      {sp.sent && <div role="status" className="tile flex items-center gap-3 bg-mint !p-5"><CheckCircle2 aria-hidden /><p className="font-semibold">Thanks. We'll check the request and email you once it's done.</p></div>}
      <section className="tile bg-sky !p-7 sm:!p-10"><h1 className="text-4xl sm:text-5xl">People</h1><p className="mt-3 max-w-xl text-lg font-medium">Who has access to {m.customer.displayName} on the portal. Need to add a colleague? Ask us below.</p></section>
      <section className="tile bg-white" aria-label="Your team">
        <ul className="divide-y divide-line">
          {people.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="flex items-center gap-3"><Avatar name={p.name} size={38} /><span><span className="block font-bold">{p.name}</span><span className="text-sm text-muted">{[p.position, p.email].filter(Boolean).join(" · ")}</span></span></span>
              <span className="text-sm font-semibold">{p.level ? <>{p.level}{p.billing && p.level !== "Owner" ? " + billing" : ""}</> : <span className="text-muted">Not on the portal</span>}</span></li>
          ))}
        </ul>
      </section>
      {pending.length > 0 && (
        <section className="tile bg-butter" aria-label="Waiting for us"><h2 className="mb-2 text-2xl">Waiting for us to check</h2>
          <ul>{pending.map((r) => <li key={r.id} className="flex items-center gap-2 py-1.5"><Clock size={16} aria-hidden /><span><strong>{r.name}</strong> as {levelLabel(r.role)}, asked {timeAgo(r.createdAt)}</span></li>)}</ul></section>
      )}
      <section className="tile bg-white !p-6 sm:!p-8"><h2 className="mb-4 text-2xl">Add someone</h2><RequestAccessForm customerId={m.customerId} /></section>
    </div>
  );
}
