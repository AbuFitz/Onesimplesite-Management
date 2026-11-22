import Link from "next/link";
import { Search } from "lucide-react";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { portalLink } from "@/lib/env";
import { listCustomerAccounts, ensureLink } from "@/modules/referrals/service";
import { AutoGetForm } from "@/components/auto-form";
import { QuickChips } from "@/components/filter-bar";
import { SheetButton } from "@/components/sheet-button";
import { CopyButton } from "@/components/copy-button";
import { DealForm } from "@/components/referral-deal";
import { Flash } from "@/components/flash";
import { Empty, money } from "@/components/ui";

export const metadata = { title: "Referral customers" };
const VIEWS = [["all", "All customers"], ["links", "Has a link"], ["deals", "Own deal"], ["owed", "Owed money"]] as const;

/** Every customer account: whether they have a link, what they earn per referral (default or their own deal), and how it has gone. */
export default async function ReferralCustomers({ searchParams }: { searchParams: Promise<{ q?: string; v?: string; done?: string; error?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const sp = await searchParams;
  const v = VIEWS.find(([id]) => id === sp.v)?.[0] ?? "all", q = sp.q?.trim().toLowerCase() ?? "";
  const { rows, settings } = await listCustomerAccounts(ctx.workspaceId);
  const match = (r: (typeof rows)[number]) => (!q || `${r.name} ${r.ref}`.toLowerCase().includes(q)) && (v === "all" || (v === "links" && !!r.code) || (v === "deals" && r.ownDeal) || (v === "owed" && r.owedMinor > 0));
  const shown = rows.filter(match);
  const count = (id: string) => rows.filter((r) => id === "all" || (id === "links" && !!r.code) || (id === "deals" && r.ownDeal) || (id === "owed" && r.owedMinor > 0)).length;
  const owner = can(ctx.role, "settings.write");
  const here = `/referrals/customers${v !== "all" ? `?v=${v}` : ""}`;
  const href = (id: string) => `/referrals/customers?${new URLSearchParams({ ...(q ? { q } : {}), ...(id !== "all" ? { v: id } : {}) })}`;
  const code = async (r: (typeof rows)[number]) => r.code ?? (owner ? await ensureLink(ctx.workspaceId, r.id) : null);
  return (
    <>
      <div className="lt"><AutoGetForm className="lt-form"><div className="lt-row"><label className="lt-search"><span className="sr-only">Search customers</span><Search size={17} aria-hidden /><input name="q" type="search" defaultValue={sp.q} placeholder="Search customers" autoComplete="off" /></label>{v !== "all" && <input type="hidden" name="v" value={v} />}</div></AutoGetForm>
        <QuickChips label="Show" items={VIEWS.map(([id, l]) => ({ label: l, count: count(id), href: href(id), on: v === id }))} />
        <p className="lt-count">Default: {settings.customerType === "percent" ? `${settings.customerValue}% of the website` : money(settings.customerValue)} per referral. Change it on the Rules page, or give a customer their own deal below.</p></div>
      <Flash done={sp.done} error={sp.error} />
      {shown.length === 0 ? <Empty title="No customers here">Try another view.</Empty> : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {await Promise.all(shown.slice(0, 150).map(async (r) => { const c = await code(r); const url = c ? portalLink(`/r/${c}`) : null; return (
            <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
              <div className="min-w-0 flex-1"><p className="truncate font-semibold"><Link className="hover:underline" href={`/customers/${r.id}`}>{r.name}</Link></p>
                <p className="text-[13.5px] text-muted">{r.reward} each{r.ownDeal ? " · their own deal" : ""} · {r.leads} {r.leads === 1 ? "lead" : "leads"} · {r.won} won{r.owedMinor > 0 ? ` · ${money(r.owedMinor)} owed` : ""}</p></div>
              <SheetButton label="Manage" title={r.name} className="evt-b" icon={false}>
                <div className="space-y-4">
                  {url && <div className="rounded-2xl bg-[#f4f5ee] p-3"><p className="text-sm text-muted">Their referral link</p><p className="mt-0.5 break-all font-mono text-[13px] select-all">{url}</p><div className="mt-2"><CopyButton text={url} /></div></div>}
                  {owner ? <DealForm workspaceId={ctx.workspaceId} customerId={r.id} back={here} /> : <p className="text-sm text-muted">Only owners can change a customer&apos;s deal.</p>}
                </div>
              </SheetButton>
            </li>); }))}
        </ul>
      )}
    </>
  );
}
