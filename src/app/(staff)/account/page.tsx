import { requireStaff } from "@/modules/identity/session";
import { ROLE_INFO } from "@/modules/identity/permissions";
import { getMyProfile, profileMissing } from "@/modules/identity/profile";
import { Avatar, ErrorSummary } from "@/components/ui";
import { AccountRows } from "@/components/account-nav";
import { PhotoUpload } from "@/components/photo-upload";
import { removePhotoAction } from "@/app/actions/photo";
import { db } from "@/lib/db";
import { accountItems } from "./items";

export const metadata = { title: "My account" };
export default async function Account({ searchParams }: { searchParams: Promise<{ error?: string; photo?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireStaff();
  const [me, twoFactor] = await Promise.all([getMyProfile(ctx), db.twoFactor.count({ where: { userId: ctx.userId, verified: true } })]);
  const missing = profileMissing(me);
  return (
    <div className="set-hub">
      <h1 className="sr-only">My account</h1>
      <ErrorSummary message={sp.error} />
      <section className="acc-me">
        <Avatar name={me.displayName} size={88} staffId={ctx.staffId} />
        <div className="min-w-0"><p className="acc-name">{me.displayName}</p><p className="acc-sub">{ROLE_INFO[ctx.role].label.replace(" (recommended)", "")}{me.username ? ` · ${me.username}` : ""}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2"><PhotoUpload /><form action={removePhotoAction}><button className="btn btn-quiet">Remove</button></form></div>
          {sp.photo === "1" && <p role="status" className="mt-2 text-sm font-semibold text-moss">Picture saved.</p>}
        </div>
      </section>
      <p className="acc-note">{me.aliasEmail ? <>Customers see your emails as <b>{me.aliasEmail}</b>. Your sign-in address stays private.</> : "No customer-facing address yet, so your emails go out as hello@. An owner can set one on the Team page."}</p>
      <AccountRows items={accountItems({ twoStep: twoFactor > 0, profileNote: missing.length ? `Add ${missing.join(" and ")}` : undefined })} />
    </div>
  );
}
