import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { requireClient } from "@/modules/identity/session";
import { Avatar } from "@/components/ui";
import { AccountRows } from "@/components/account-nav";
import { PhotoUpload } from "@/components/photo-upload";
import { removeClientPhotoAction } from "@/app/actions/photo";
import { db } from "@/lib/db";
import { portalItems } from "./items";

export const metadata = { title: "Settings" };
export default async function Account({ searchParams }: { searchParams: Promise<{ error?: string; photo?: string }> }) {
  const c = await requireClient();
  const sp = await searchParams;
  const t = await db.twoFactor.count({ where: { userId: c.userId, verified: true } });
  return (
    <div className="set-hub">
      <h1 className="sr-only">Settings</h1>
      <section className="acc-me">
        <Avatar name={c.name ?? "You"} size={88} staffId={c.userId} base="/avatar/u" />
        <div className="min-w-0"><p className="acc-name">{c.name ?? "You"}</p><p className="acc-sub">{c.memberships.map((m) => m.customer.displayName).join(", ")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2"><PhotoUpload client /><form action={removeClientPhotoAction}><button className="btn btn-quiet">Remove</button></form></div>
          {sp.photo === "1" && <p role="status" className="mt-2 text-sm font-semibold text-moss">Picture saved.</p>}
          {sp.error && <p role="alert" className="mt-2 text-sm font-semibold text-[#7a2e12]">{sp.error}</p>}
        </div>
      </section>
      <div className="mt-4"><AccountRows items={portalItems({ twoStep: t > 0, companies: c.memberships.length })} /></div>
      <Link href="/help/new" className="set-me mt-4"><span className="set-ico" style={{ background: "#c2410c" }} aria-hidden><LifeBuoy size={19} /></span><span className="set-txt"><b>Need something changed?</b><small>A new email, a colleague who left, more access</small></span></Link>
    </div>
  );
}
