import { getCompanyDeal, effectiveReward, rewardText } from "@/modules/referrals/service";
import { setCompanyDealAction } from "@/app/actions/referrals";

/** A company's own referral deal, or "use the default". Used on the company page and in the Customers list. */
export async function DealForm({ workspaceId, customerId, back }: { workspaceId: string; customerId: string; back: string }) {
  const [deal, eff] = await Promise.all([getCompanyDeal(workspaceId, customerId), effectiveReward(workspaceId, customerId)]);
  return (
    <form action={setCompanyDealAction} className="rl"><input type="hidden" name="id" value={customerId} /><input type="hidden" name="back" value={back} />
      <section><h3>What they earn for each referral</h3>
        <div className="rchips"><label className="rchip"><input type="radio" name="type" value="" defaultChecked={!deal.type} /><span>Use the default</span></label><label className="rchip"><input type="radio" name="type" value="fixed" defaultChecked={deal.type === "fixed"} /><span>A set amount (£)</span></label><label className="rchip"><input type="radio" name="type" value="percent" defaultChecked={deal.type === "percent"} /><span>A percentage of the website (%)</span></label></div>
        <label className="label" htmlFor="cd-v">Amount in £, or percent</label><input id="cd-v" name="value" type="number" min="0" step="1" className="field" defaultValue={deal.type === "percent" ? (deal.value ?? "") : deal.value !== null ? deal.value / 100 : ""} placeholder="Empty means the default" />
        <p>The default is {rewardText(eff.settings.customerType, eff.settings.customerValue)}.</p></section>
      <section><h3>What the people they send get</h3>
        <label className="label" htmlFor="cd-m">Free months</label><input id="cd-m" name="months" type="number" min="0" max="12" className="field" defaultValue={deal.months ?? ""} placeholder={`Default is ${eff.settings.welcome.standard.months}`} />
        <p>Empty means the default.</p></section>
      <button className="btn w-full justify-center">Save deal</button>
    </form>
  );
}
