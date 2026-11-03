import { requireStaff } from "@/modules/identity/session";
import { getSettings, listPlans, money } from "@/modules/settings/plans";
import { VARIABLES } from "@/modules/settings/variables";
import { saveSettingsAction, savePlanAction } from "@/app/actions/work";
import { SettingsNav } from "@/components/settings-nav";
import { RecordHeader, ErrorSummary } from "@/components/ui";

export const metadata = { title: "Plans and details" };
const GROUPS = [
  ["contact", "Contact details", "Where customers write to us. Documents quote these."],
  ["service", "Service details", "What the Service Level Agreement and Hosting terms promise."],
  ["commercial", "Commercial details", "Decisions the documents need before an order can be sent."],
] as const;

export default async function Plans({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const ctx = await requireStaff("settings.write");
  const sp = await searchParams;
  const [stored, plans] = await Promise.all([getSettings(ctx.workspaceId), listPlans(ctx.workspaceId)]);
  return (
    <>
      <RecordHeader title="Settings" meta="Company details, plans, legal documents and emails" />
      <SettingsNav current="plans" />
      <ErrorSummary message={sp.error} />
      {sp.saved && <p role="status" className="mb-4 text-sm text-moss">Saved. New orders use these values. Orders already sent keep the figures the customer agreed.</p>}
      <p className="mb-8 max-w-2xl text-sm text-muted">Prices, support hours and email addresses live here, not inside the legal wording. Change one here and every document that quotes it updates the next time an order is sent.</p>

      <section aria-labelledby="pl" className="card-section">
        <h2 id="pl">Care plans</h2>
        <p className="mb-4 text-sm text-muted">What you sell each month. Picking a plan on a ticket adds its price and fills the plan section of the agreement.</p>
        <ul className="grid gap-4 lg:grid-cols-2">
          {plans.map((p) => (
            <li key={p.id} className="rounded-2xl border border-line p-5">
              <form action={savePlanAction} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={p.id} />
                <div className="sm:col-span-2 flex items-center justify-between gap-3"><p className="font-semibold">{p.name} <span className="font-normal text-muted">· {money(p.monthlyMinor)} a month</span></p><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={p.active} />On sale</label></div>
                <PlanFields p={p} />
                <div className="sm:col-span-2"><button className="btn btn-quiet">Save {p.name}</button></div>
              </form>
            </li>
          ))}
          <li className="rounded-2xl border border-dashed border-line p-5">
            <form action={savePlanAction} className="grid gap-3 sm:grid-cols-2">
              <p className="sm:col-span-2 font-semibold">Add a plan</p>
              <input type="hidden" name="active" value="on" /><input type="hidden" name="id" value="" />
              <PlanFields />
              <div className="sm:col-span-2"><button className="btn">Add plan</button></div>
            </form>
          </li>
        </ul>
      </section>

      <form action={saveSettingsAction} className="max-w-3xl space-y-10">
        {GROUPS.map(([id, title, about]) => (
          <section key={id} aria-labelledby={`g-${id}`} className="card-section">
            <h2 id={`g-${id}`}>{title}</h2><p className="mb-4 mt-1 text-sm text-muted">{about}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {VARIABLES.filter((v) => v.group === id).map((v) => {
                const val = stored[v.key] ?? v.default ?? "";
                return (
                  <div key={v.key} className={v.multiline ? "sm:col-span-2" : ""}>
                    <label className="label" htmlFor={`v-${v.key}`}>{v.label}{!val.trim() && <span className="ml-2 rounded-full bg-[#fff3da] px-2 py-0.5 text-xs font-medium text-warn">Needed</span>}</label>
                    {v.multiline ? <textarea id={`v-${v.key}`} name={v.key} rows={2} className="field" defaultValue={val} /> : <input id={`v-${v.key}`} name={v.key} className="field" defaultValue={val} />}
                    {v.hint && <p className="hint mt-1">{v.hint}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        <button className="btn">Save details</button>
      </form>
    </>
  );
}

function PlanFields({ p }: { p?: { name: string; kind: string; monthlyMinor: number; revisionsPerMonth: number; backupFrequency: string | null; backupRetention: string | null; summary: string | null } }) {
  const id = p?.name ?? "new";
  return (
    <>
      <div><label className="label" htmlFor={`pn-${id}`}>Name</label><input id={`pn-${id}`} name="name" className="field" defaultValue={p?.name} required /></div>
      <div><label className="label" htmlFor={`pk-${id}`}>Type of website</label><select id={`pk-${id}`} name="kind" className="field" defaultValue={p?.kind ?? "custom"}><option value="standard">Standard</option><option value="ecommerce">E-commerce</option><option value="custom">Something else</option></select></div>
      <div><label className="label" htmlFor={`pp-${id}`}>Price per month (£)</label><input id={`pp-${id}`} name="price" type="number" min={0} step="0.01" inputMode="decimal" className="field" defaultValue={p ? (p.monthlyMinor / 100).toFixed(2) : ""} required /></div>
      <div><label className="label" htmlFor={`pr-${id}`}>Website revisions each month</label><input id={`pr-${id}`} name="revisionsPerMonth" type="number" min={0} className="field" defaultValue={p?.revisionsPerMonth ?? 3} required /></div>
      <div><label className="label" htmlFor={`bf-${id}`}>Backups</label><input id={`bf-${id}`} name="backupFrequency" className="field" placeholder="Daily or Weekly" defaultValue={p?.backupFrequency ?? ""} /></div>
      <div><label className="label" htmlFor={`br-${id}`}>Backups are kept for</label><input id={`br-${id}`} name="backupRetention" className="field" placeholder="14 days" defaultValue={p?.backupRetention ?? ""} /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor={`ps-${id}`}>One-line summary</label><input id={`ps-${id}`} name="summary" className="field" defaultValue={p?.summary ?? ""} /></div>
    </>
  );
}
