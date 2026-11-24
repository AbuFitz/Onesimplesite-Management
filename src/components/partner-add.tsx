import { SheetButton } from "./sheet-button";
import { RewardPicker } from "./reward-picker";
import { createPartnerAction } from "@/app/actions/referrals";

/** Add an agency or individual who sends us work. Used by the Referrals hero and the Partners page. */
export function PartnerAdd({ back, className = "lt-add" }: { back: string; className?: string }) {
  return (
    <SheetButton label="Add a partner" title="Add a partner" className={className}>
      <form action={createPartnerAction} className="rl"><input type="hidden" name="back" value={back} />
        <section><label className="label" htmlFor="pt-n">Name</label><input id="pt-n" name="name" className="field" required autoComplete="off" />
          <div className="rl-two"><div><label className="label" htmlFor="pt-k">Kind</label><select id="pt-k" name="kind" className="field"><option value="agency">Agency</option><option value="individual">Individual</option></select></div><div><label className="label" htmlFor="pt-e">Email (optional)</label><input id="pt-e" name="email" type="email" className="field" autoComplete="off" /></div></div></section>
        <section><h3>What they earn</h3><RewardPicker typeName="type" valueName="value" type="fixed" value={50} /></section>
        <button className="btn w-full justify-center">Add and get their link</button>
      </form>
    </SheetButton>
  );
}
