import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { portalLink } from "@/lib/env";
import { listPartners } from "@/modules/referrals/service";
import { SheetButton } from "@/components/sheet-button";
import { CopyButton } from "@/components/copy-button";
import { Flash } from "@/components/flash";
import { Empty, Status, money } from "@/components/ui";
import { createPartnerAction, togglePartnerAction } from "@/app/actions/referrals";

export const metadata = { title: "Referral partners" };
/** Agencies, individuals and team members who send work, each with their own link and rate. */
export default async function Partners({ searchParams }: { searchParams: Promise<{ done?: string; error?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const sp = await searchParams;
  const partners = await listPartners(ctx.workspaceId);
  const owner = can(ctx.role, "settings.write");
  const here = "/referrals/partners";
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm text-muted">{partners.length} {partners.length === 1 ? "partner" : "partners"}. Team members appear here once they open their link.</p>
        {owner && (
          <SheetButton label="Add partner" title="Add a partner" className="lt-add">
            <form action={createPartnerAction} className="rl"><input type="hidden" name="back" value={here} />
              <section><label className="label" htmlFor="pt-n">Name</label><input id="pt-n" name="name" className="field" required autoComplete="off" />
                <div className="rl-two"><div><label className="label" htmlFor="pt-k">Kind</label><select id="pt-k" name="kind" className="field"><option value="agency">Agency</option><option value="individual">Individual</option></select></div><div><label className="label" htmlFor="pt-e">Email (optional)</label><input id="pt-e" name="email" type="email" className="field" autoComplete="off" /></div></div></section>
              <section><h3>What they earn</h3><div className="rchips"><label className="rchip"><input type="radio" name="type" value="fixed" defaultChecked /><span>A set amount (£)</span></label><label className="rchip"><input type="radio" name="type" value="percent" /><span>A percentage of the website (%)</span></label></div>
                <label className="label" htmlFor="pt-v">Amount or percent</label><input id="pt-v" name="value" type="number" min="0" step="1" defaultValue="50" className="field" required /></section>
              <button className="btn w-full justify-center">Add and get their link</button>
            </form>
          </SheetButton>
        )}
      </div>
      <Flash done={sp.done} error={sp.error} />
      {partners.length === 0 ? <Empty title="No partners yet">Add an agency or individual who sends you work. They get a link and a rate.</Empty> : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">{partners.map((p) => { const url = portalLink(`/r/${p.code}`); return (
          <li key={p.id} className="px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><p className="min-w-0 flex-1 font-semibold">{p.name} <span className="font-normal text-muted">· {p.kind === "agency" ? "agency" : p.kind === "team" ? "team member" : "individual"} · {p.commissionType === "percent" ? `${p.commissionValue}% of the website` : money(p.commissionValue)}</span></p>{!p.active && <Status label="Paused" kind="warn" />}</div>
            <p className="mt-0.5 text-[13.5px] text-muted">{p.leads} {p.leads === 1 ? "lead" : "leads"} · {p.won} won · {money(Math.max(0, p.owedMinor))} owed</p>
            <p className="mt-1.5 break-all font-mono text-[13px] text-ink/80 select-all">{url}</p>
            <div className="mt-2 flex flex-wrap gap-2"><CopyButton text={url} />{owner && p.kind !== "team" && <form action={togglePartnerAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="active" value={p.active ? "0" : "1"} /><input type="hidden" name="back" value={here} /><button className="evt-b">{p.active ? "Pause" : "Resume"}</button></form>}</div>
          </li>); })}</ul>
      )}
    </>
  );
}
