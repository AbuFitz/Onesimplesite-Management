import { Check, Circle } from "lucide-react";
import { requireStaff } from "@/modules/identity/session";
import { ROLE_INFO } from "@/modules/identity/permissions";
import { getMyProfile, profileMissing } from "@/modules/identity/profile";
import { ChangePasswordForm } from "@/components/password-forms";
import { ProfileForm, ChangeEmailForm } from "@/components/profile-forms";
import { RecordHeader } from "@/components/ui";

export const metadata = { title: "My account" };
export default async function Account() {
  const ctx = await requireStaff();
  const me = await getMyProfile(ctx);
  const missing = profileMissing(me);
  const steps = [["Job title", !!me.jobTitle], ["Email signature", !!me.signature]] as const;
  return (
    <>
      <RecordHeader title="My account" meta={`${ROLE_INFO[ctx.role].label}${me.username ? ` · username ${me.username}` : ""}`} />
      {missing.length > 0 && (
        <div className="mb-8 rounded-2xl border border-line bg-soft px-5 py-4">
          <p className="font-semibold">Finish setting up your profile</p>
          <p className="mb-3 text-sm text-muted">Two quick things so customers see who you are.</p>
          <ul className="space-y-1.5 text-sm">{steps.map(([l, done]) => <li key={l} className="flex items-center gap-2">{done ? <Check size={16} className="text-moss" aria-hidden /> : <Circle size={16} className="text-muted" aria-hidden />}<span className={done ? "text-muted line-through" : ""}>{l}</span></li>)}</ul>
        </div>
      )}
      <section aria-labelledby="pr" className="mb-12"><h2 id="pr" className="mb-4">Profile and email signature</h2>
        <ProfileForm email={me.email} initial={{ name: me.displayName, jobTitle: me.jobTitle ?? "", phone: me.phone ?? "", signature: me.signature ?? "" }} /></section>
      <section aria-labelledby="em" className="mb-12"><h2 id="em" className="mb-4">Sign-in email</h2><ChangeEmailForm email={me.email} /></section>
      <section aria-labelledby="pw"><h2 id="pw" className="mb-3">Change password</h2><ChangePasswordForm /></section>
    </>
  );
}
