import { Check, Circle } from "lucide-react";
import { requireStaff } from "@/modules/identity/session";
import { ROLE_INFO } from "@/modules/identity/permissions";
import { getMyProfile, profileMissing } from "@/modules/identity/profile";
import { ChangePasswordForm } from "@/components/password-forms";
import { ProfileForm, ChangeEmailForm } from "@/components/profile-forms";
import { RecordHeader, Avatar, ErrorSummary } from "@/components/ui";
import { SecurityPanel } from "@/components/security-panel";
import { db } from "@/lib/db";
import { PhotoUpload } from "@/components/photo-upload";
import { removePhotoAction } from "@/app/actions/photo";

export const metadata = { title: "My account" };
export default async function Account({ searchParams }: { searchParams: Promise<{ error?: string; photo?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireStaff();
  const me = await getMyProfile(ctx);
  const missing = profileMissing(me);
  const hasTotp = !!(await db.twoFactor.count({ where: { userId: ctx.userId, verified: true } }));
  const steps = [["Job title", !!me.jobTitle], ["Email signature", !!me.signature]] as const;
  return (
    <>
      <RecordHeader title="My account" meta={`${ROLE_INFO[ctx.role].label}${me.username ? ` · username ${me.username}` : ""}`} />
      <ErrorSummary message={sp.error} />
      {sp.photo === "1" && <p role="status" className="mb-4 text-sm text-moss">Picture saved.</p>}
      <section aria-labelledby="ph" className="mb-10 flex flex-wrap items-center gap-5"><Avatar name={me.displayName} size={72} staffId={ctx.staffId} />
        <div><h2 id="ph" className="mb-2 text-lg">Your picture</h2><div className="flex flex-wrap items-center gap-3"><PhotoUpload /><form action={removePhotoAction}><button className="btn btn-quiet">Remove</button></form></div><p className="mt-2 text-sm text-muted">Shown to your team, and to customers beside your replies.</p></div></section>
      <p className="mb-8 max-w-2xl rounded-2xl bg-soft px-5 py-4 text-sm">{me.aliasEmail ? <>Customers see your emails and ticket replies as <strong>{me.aliasEmail}</strong>. Your sign-in address stays private.</> : <>No customer-facing address is set for you yet, so your emails go out as hello@. Ask an owner to set one on the Team page.</>}</p>
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
      <section aria-labelledby="sec" className="mb-10 max-w-2xl"><h2 id="sec" className="mb-3 text-lg">Sign-in security</h2><SecurityPanel ns="staff" hasAuthenticator={hasTotp} /></section>
      <section aria-labelledby="pw"><h2 id="pw" className="mb-3">Change password</h2><ChangePasswordForm /></section>
    </>
  );
}
