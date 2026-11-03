import Link from "next/link";
import { LifeBuoy, Plus } from "lucide-react";
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
        <Link href="/help/new" className="btn btn-dark mt-6 inline-flex"><Plus size={18} aria-hidden /> Raise a ticket</Link>
      </section>
      {tickets.length === 0 ? (
        <section className="tile bg-white text-center !py-14"><LifeBuoy className="mx-auto mb-3" size={36} aria-hidden /><h2 className="text-2xl">No tickets yet</h2><p className="mx-auto mt-2 max-w-md text-muted">When you raise one it will show up here, with our replies.</p></section>
      ) : (
        <>
          <List title="Open" items={open} empty="Nothing open right now." />
          {done.length > 0 && <List title="Sorted" items={done} />}
        </>
      )}
      <p className="px-2 text-sm text-muted">Prefer email? <a className="underline" href="mailto:support@onesimplesite.co.uk">support@onesimplesite.co.uk</a> works too.</p>
    </div>
  );
}

function List({ title, items, empty }: { title: string; items: Awaited<ReturnType<typeof clientTickets>>; empty?: string }) {
  return (
    <section className="tile bg-white" aria-label={title}>
      <h2 className="mb-3 text-2xl">{title}</h2>
      {items.length === 0 ? <p className="text-muted">{empty}</p> : (
        <ul className="divide-y divide-line">
          {items.map((t) => (
            <li key={t.id}><Link href={`/help/${t.id}`} className="flex flex-wrap items-center justify-between gap-2 py-4 hover:bg-bone/60 -mx-3 px-3 rounded-xl">
              <span><span className="block font-bold">{t.title}</span><span className="text-sm text-muted">{t.reference} · updated {timeAgo(t.updatedAt)}</span></span>
              <ClientStatus status={t.status} />
            </Link></li>
          ))}
        </ul>
      )}
    </section>
  );
}
