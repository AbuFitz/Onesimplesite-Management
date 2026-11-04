import { redirect } from "next/navigation";
import { requireStaff } from "@/modules/identity/session";
import { db } from "@/lib/db";
import { saveSecuritySettings, securityFrom, CODE_MODES, type CodeMode } from "@/modules/identity/security";
import { DomainError } from "@/lib/errors";
import { SubmitButton } from "@/components/submit-button";
import { RecordHeader, ErrorSummary } from "@/components/ui";

export const metadata = { title: "Sign-in security" };

async function save(fd: FormData) {
  "use server";
  const ctx = await requireStaff("settings.write");
  try { await saveSecuritySettings(ctx, { codes: fd.get("codes"), testers: fd.get("testers") }); }
  catch (e) { redirect(`/settings/security?error=${encodeURIComponent(e instanceof DomainError ? e.message : "Couldn't save that.")}`); }
  redirect("/settings/security?saved=1");
}

const MODES: Record<CodeMode, { label: string; about: string }> = {
  off: { label: "Off", about: "Nobody is required to. Passkeys and authenticator apps are still there for anyone who wants them." },
  testers: { label: "Only the emails I list", about: "Switch it on for yourself first. Only these addresses are required to set it up." },
  team: { label: "Everyone on the team", about: "Every team member is guided through setup at their next sign-in." },
  everyone: { label: "Team and customers", about: "Customers are guided through setup too, on their next sign-in." },
};

export default async function Security({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const ctx = await requireStaff("settings.write");
  const sp = await searchParams;
  const w = await db.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId }, select: { settings: true } });
  const sec = securityFrom(w.settings);
  const [keys, totp, staff] = await Promise.all([db.passkey.count(), db.twoFactor.count({ where: { verified: true } }), db.staffMembership.count({ where: { workspaceId: ctx.workspaceId, status: "active" } })]);
  return (
    <>
      <RecordHeader title="Sign-in security" meta="Two-step sign-in, passkeys and trusted devices" />
      {sp.saved && <p role="status" className="mb-4 rounded-lg bg-[#e9f6ef] px-4 py-3 text-sm text-[#0a5a3d]">Saved. It applies from the next sign-in.</p>}
      <ErrorSummary message={sp.error} />
      <form action={save} className="max-w-3xl">
        <section className="card-section" aria-labelledby="oc">
          <h2 id="oc">Require two-step sign-in</h2>
          <p className="mb-3 text-sm text-ink/70">Anyone required to use it is guided through setting up an authenticator app straight after their password, then asked for a code on each new device (trusted for 30 days). Roll it out in stages so nobody is surprised: start with your own email, then widen it. You can switch it off here at any time, and reset anyone from the Team page or a company's People tab if they lose their phone.</p>
          <fieldset className="space-y-2"><legend className="sr-only">Who is asked for a code</legend>
            {CODE_MODES.map((m) => (
              <label key={m} className="flex cursor-pointer gap-3 rounded-xl border border-[var(--card-line)] bg-white p-3 has-[:checked]:border-ink has-[:checked]:bg-[#eef7f2]"><input type="radio" name="codes" value={m} defaultChecked={sec.codes === m} className="mt-1 size-4 accent-[#0c6a49]" /><span><span className="block font-semibold">{MODES[m].label}</span><span className="text-sm text-ink/70">{MODES[m].about}</span></span></label>
            ))}
          </fieldset>
          <div className="mt-4"><label className="label" htmlFor="testers">Emails to test with <span className="font-normal text-muted">(used by “Only the emails I list”, one per line)</span></label>
            <textarea id="testers" name="testers" rows={3} className="field" defaultValue={sec.testers.join("\n")} placeholder="you@onesimplesite.co.uk" /></div>
          <p className="mt-3 text-sm text-ink/70">Emails are only used for security notices: one when someone signs in from a device we haven't seen, and one when support resets someone.</p>
        </section>
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
      </form>
      <section className="card-section mt-8 max-w-3xl" aria-labelledby="st"><h2 id="st">Where things stand</h2>
        <ul className="mt-2 space-y-1 text-sm"><li><strong>{keys}</strong> passkey{keys === 1 ? "" : "s"} registered</li><li><strong>{totp}</strong> authenticator app{totp === 1 ? "" : "s"} set up</li><li><strong>{staff}</strong> active team member{staff === 1 ? "" : "s"}</li></ul>
        <p className="mt-3 text-sm text-ink/70">People add passkeys and authenticator apps themselves from <em>My account</em> (team) or <em>Settings</em> (customers).</p>
      </section>
    </>
  );
}
