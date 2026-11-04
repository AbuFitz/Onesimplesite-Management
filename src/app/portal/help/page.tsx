import Link from "next/link";
import { LifeBuoy, Plus } from "lucide-react";
import { clientCanAny } from "@/modules/portal/access";
import { requireClient } from "@/modules/identity/session";
import { clientTickets } from "@/modules/support/service";
import { ClientStatus } from "@/components/portal-bits";
import { timeAgo } from "@/components/ui";

export const metadata = { title: "Help" };

export default async function Help() {
  const c = await requireClient();
  const tickets = await clientTickets(c);
  const open = tickets.filter((t) => !["resolved", "closed"].includes(t.status));
  const done = tickets.filter((t) => ["resolved", "closed"].includes(t.status));
  return (
    <div className="space-y-4">
      <section className="tile bg-blush !p-7 sm:!p-10">
        <h1 className="text-4xl sm:text-5xl">Help</h1>
        <p className="mt-3 max-w-xl text-lg font-medium">Something not right, or want a change? Tell us here and we'll reply by email and on this page.</p>
        {clientCanAny(c, "tickets") ? <Link href="/help/new" className="btn btn-dark mt-6 inline-flex"><Plus size={18} aria-hidden /> Raise a ticket</Link> : <p className="mt-4 text-sm font-semibold">You have view-only access. Ask the company owner if you need to raise something.</p>}
      </section>
      {tickets.length === 0 ? (
        <section className="tile bg-white text-center !py-14"><LifeBuoy className="mx-auto mb-3" size={36} aria-hidden /><h2 className="text-2xl">No tickets yet</h2><p className="mx-auto mt-2 max-w-md text-muted">When you raise one it will show up here, with our replies.</p></section>
      ) : (
        <>
          <List title="Open" items={open} empty="Nothing open right now." me={c.email} many={c.memberships.length > 1} />
          {done.length > 0 && <List title="Sorted" items={done} me={c.email} many={c.memberships.length > 1} />}
        </>
      )}
      <p className="px-2 text-sm text-muted">Prefer email? <a className="underline" href="mailto:support@onesimplesite.co.uk">support@onesimplesite.co.uk</a> works too.</p>
    </div>
  );
}

const STEP = (st: string, assigned?: string | null) => (["resolved", "closed"].includes(st) ? 3 : assigned || ["in_progress", "customer_replied", "waiting_customer"].includes(st) ? 2 : 1);
function List({ title, items, empty, me, many }: { title: string; items: Awaited<ReturnType<typeof clientTickets>>; empty?: string; me?: string; many?: boolean }) {
  return (
    <section className="tile bg-white" aria-label={title}>
      <h2 className="mb-3 text-2xl">{title}</h2>
      {items.length === 0 ? <p className="text-muted">{empty}</p> : (
        <ul className="divide-y divide-line">
          {items.map((t) => (
            <li key={t.id}><Link href={`/help/${t.id}`} className="flex flex-wrap items-center justify-between gap-2 py-4 hover:bg-bone/60 -mx-3 px-3 rounded-xl">
              <span className="min-w-0"><span className="block font-bold">{t.title}</span><span className="block text-sm text-muted">{t.reference} · {t.contact ? (t.contact.email && me && t.contact.email.toLowerCase() === me.toLowerCase() ? "raised by you" : `raised by ${t.contact.name}`) : "raised by us"}{many ? ` · ${t.customer.displayName}` : ""} · updated {timeAgo(t.updatedAt)}</span><span className="mt-2 flex w-40 gap-1" role="img" aria-label={`Progress: step ${STEP(t.status, t.assigneeId)} of 3`}>{[1, 2, 3].map((i) => <i key={i} className={`h-1.5 flex-1 rounded-full ${i <= STEP(t.status, t.assigneeId) ? "bg-ink" : "bg-line"}`} />)}</span></span>
              <ClientStatus status={t.status} />
            </Link></li>
          ))}
        </ul>
      )}
    </section>
  );
}
