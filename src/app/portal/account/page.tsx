import Link from "next/link";
import { Building2, KeyRound, LifeBuoy, ShieldCheck, FileText } from "lucide-react";
import { ChangePasswordForm } from "@/components/password-forms";
import { requireClient } from "@/modules/identity/session";
import { levelLabel } from "@/modules/portal/access";
import { Avatar } from "@/components/ui";
import { PhotoUpload } from "@/components/photo-upload";
import { removeClientPhotoAction } from "@/app/actions/photo";

export const metadata = { title: "Settings" };

export default async function Account({ searchParams }: { searchParams: Promise<{ error?: string; photo?: string }> }) {
  const c = await requireClient();
  const sp = await searchParams;
  return (
    <div className="space-y-4">
      <section className="tile bg-lilac !p-7 sm:!p-10">
        <div className="flex flex-wrap items-center gap-4"><Avatar name={c.name ?? "You"} size={64} staffId={c.userId} base="/avatar/u" /><div><h1 className="text-3xl sm:text-5xl">{c.name ?? "Your settings"}</h1><p className="mt-1 text-lg font-medium">{c.email}</p></div></div>
      </section>

      <section className="tile bg-white" aria-labelledby="ph"><h2 id="ph" className="text-2xl">Your picture</h2>
        <p className="mt-1 text-sm text-muted">Optional. Your team at OneSimpleSite and the people in your company will see it next to your name. It's yours across every company you belong to.</p>
        {sp.photo === "1" && <p role="status" className="mt-2 text-sm font-semibold text-moss">Picture saved.</p>}
        {sp.error && <p role="alert" className="mt-2 text-sm font-semibold text-[#7a2e12]">{sp.error}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3"><PhotoUpload client /><form action={removeClientPhotoAction}><button className="btn btn-quiet">Remove picture</button></form></div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="tile bg-white" aria-labelledby="biz"><h2 id="biz" className="flex items-center gap-2 text-2xl"><Building2 size={22} aria-hidden /> Your companies</h2>
          <ul className="mt-3 divide-y divide-line">{c.memberships.map((m) => (
            <li key={m.customerId} className="flex items-center justify-between gap-3 py-3"><span className="font-semibold">{m.customer.displayName}</span>
              <span className="rounded-full bg-bone px-3 py-1 text-sm font-bold">{levelLabel(m.role)}{m.billing && m.role !== "admin" ? " + billing" : ""}</span></li>
          ))}</ul>
          <p className="mt-3 text-sm text-muted">Your access level decides what you can do. The company owner can ask us to change it.</p>
        </section>

        <section className="tile bg-butter" aria-labelledby="help"><h2 id="help" className="flex items-center gap-2 text-2xl"><LifeBuoy size={22} aria-hidden /> Need something changed?</h2>
          <p className="mt-2">Different email, a colleague who has left, or more access? Tell us and we'll sort it.</p>
          <Link href="/help/new" className="btn btn-dark mt-4">Raise a ticket</Link>
        </section>
      </div>

      <section className="tile bg-white" aria-labelledby="pw"><h2 id="pw" className="flex items-center gap-2 text-2xl"><KeyRound size={22} aria-hidden /> Change your password</h2>
        <div className="mt-4 max-w-md"><ChangePasswordForm /></div>
      </section>

      <section className="tile bg-white" aria-labelledby="priv"><h2 id="priv" className="flex items-center gap-2 text-2xl"><ShieldCheck size={22} aria-hidden /> Privacy and legal</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">{[["/legal/privacy", "Privacy notice"], ["/legal/cookies", "Cookie notice"], ["/legal/terms", "Terms of use"]].map(([h, l]) => <li key={h}><Link href={h} className="flex min-h-12 items-center gap-2 rounded-xl border border-line px-4 font-semibold hover:bg-bone"><FileText size={17} aria-hidden />{l}</Link></li>)}</ul>
      </section>
    </div>
  );
}
