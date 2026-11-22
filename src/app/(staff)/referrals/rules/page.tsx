import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { getSettings } from "@/modules/referrals/service";
import { RewardPicker } from "@/components/reward-picker";
import { Flash } from "@/components/flash";
import { saveReferralSettingsAction } from "@/app/actions/referrals";

export const metadata = { title: "Referral rules" };
/** The rules in one place: when a reward is earned, the default reward, what new customers get, and the team's reward. */
export default async function Rules({ searchParams }: { searchParams: Promise<{ done?: string; error?: string }> }) {
  const ctx = await requireStaff("customer.read");
  const sp = await searchParams;
  const s = await getSettings(ctx.workspaceId), w = s.welcome;
  const owner = can(ctx.role, "settings.write");
  return (
    <div className="max-w-2xl">
      <Flash done={sp.done} error={sp.error} />
      {!owner && <p className="mb-4 rounded-xl bg-bone px-4 py-3 text-sm">Only owners can change the rules. This is how they are set now.</p>}
      <form action={saveReferralSettingsAction} className="rl"><fieldset disabled={!owner} className="rl"><input type="hidden" name="back" value="/referrals/rules" />
        <label className="ab-switch" htmlFor="rs-on"><span>Referrals are on</span><span className="sw"><input id="rs-on" type="checkbox" name="enabled" defaultChecked={s.enabled} /><i aria-hidden /></span></label>
        <section><h3>When is a reward earned?</h3>
          <div className="rchips"><label className="rchip"><input type="radio" name="trigger" value="final" defaultChecked={s.trigger === "final"} /><span>Website fully paid for</span></label><label className="rchip"><input type="radio" name="trigger" value="deposit" defaultChecked={s.trigger === "deposit"} /><span>Deposit paid</span></label></div>
          <p>Not when someone clicks a link or signs. Only once real money has arrived.</p></section>
        <section><h3>Default reward for a customer who refers someone</h3>
          <RewardPicker typeName="rewardType" valueName="reward" type={s.customerType} value={s.customerType === "percent" ? s.customerValue : s.customerValue / 100} />
          <div className="rl-two"><div><label className="label" htmlFor="rs-c">Most rewards per customer a year</label><input id="rs-c" name="cap" type="number" min="1" step="1" defaultValue={s.yearlyCap} className="field" /></div></div>
          <p>Any customer can have their own deal on the Customers page.</p></section>
        <section><h3>What the new customer gets</h3>
          <div className="rl-row"><span>Normal website</span><input aria-label="Free months for a normal website" name="stdMonths" type="number" min="0" max="12" defaultValue={w.standard.months} className="field" /><em>months of</em><input aria-label="What it is" name="stdLabel" className="field" defaultValue={w.standard.label} /></div>
          <div className="rl-row"><span>Online shop</span><input aria-label="Free months for an online shop" name="ecoMonths" type="number" min="0" max="12" defaultValue={w.ecommerce.months} className="field" /><em>months of</em><input aria-label="What it is" name="ecoLabel" className="field" defaultValue={w.ecommerce.label} /></div>
          <p>Added to their monthly plan before it starts.</p></section>
        <section><h3>Team members</h3>
          <label className="label" htmlFor="rs-t">Reward when a team member&apos;s referral is won (£)</label><input id="rs-t" name="team" type="number" min="0" step="1" defaultValue={s.teamRewardMinor / 100} className="field" />
          <p>Everyone on the team has their own link under My referrals. Set 0 to just track them.</p></section>
        {owner && <button className="btn w-full justify-center sm:w-auto">Save rules</button>}
      </fieldset></form>
    </div>
  );
}
