"use client";
import { useActionState, useState } from "react";
import { saveProfileAction, changeEmailAction } from "@/app/actions/profile";
import { ErrorSummary } from "./ui";

type P = { name: string; jobTitle: string; phone: string; signature: string };

function suggest(p: Pick<P, "name" | "jobTitle" | "phone">) {
  return ["Kind regards,", p.name, p.jobTitle, "OneSimpleSite", p.phone, "onesimplesite.co.uk"].map((x) => x.trim()).filter(Boolean).join("\n");
}

/** Details and signature on one form: the preview updates as you type, nothing is sent until you save. */
export function ProfileForm({ initial, email }: { initial: P; email: string }) {
  const [s, act, pending] = useActionState(saveProfileAction, undefined as { error?: string; done?: boolean } | undefined);
  const [p, setP] = useState(initial);
  const set = (k: keyof P) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setP({ ...p, [k]: e.target.value });
  return (
    <form action={act} className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-4">
        <ErrorSummary message={s?.error} />
        {s?.done && <p role="status" className="text-sm text-moss">Saved.</p>}
        <div><label className="label" htmlFor="pf-name">Your name</label><input id="pf-name" name="name" className="field" value={p.name} onChange={set("name")} required autoComplete="name" /></div>
        <div><label className="label" htmlFor="pf-title">Job title</label><input id="pf-title" name="jobTitle" className="field" value={p.jobTitle} onChange={set("jobTitle")} placeholder="e.g. Web designer" autoComplete="organization-title" /></div>
        <div><label className="label" htmlFor="pf-phone">Phone <span className="font-normal text-muted">(optional)</span></label><input id="pf-phone" name="phone" type="tel" inputMode="tel" className="field" value={p.phone} onChange={set("phone")} autoComplete="tel" /></div>
        <div>
          <div className="flex items-center justify-between"><label className="label" htmlFor="pf-sig">Email signature</label>
            <button type="button" className="text-sm underline" onClick={() => setP({ ...p, signature: suggest(p) })}>Write one for me</button></div>
          <textarea id="pf-sig" name="signature" rows={7} className="field" value={p.signature} onChange={set("signature")} placeholder={"Kind regards,\nYour name"} />
          <p className="hint mt-1">Added to the bottom of emails you send to customers from the system.</p>
        </div>
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
      </div>
      <div>
        <p className="label mb-2">Preview</p>
        <div className="rounded-2xl border border-line">
          <div className="space-y-1 border-b border-line px-4 py-3 text-sm"><p><span className="text-muted">From </span>{p.name || "You"} &lt;{email}&gt;</p><p><span className="text-muted">To </span>customer@example.com</p></div>
          <div className="px-4 py-4 text-[15px]">
            <p>Hi Alex,</p><p className="mt-3">Thanks for your time today. The agreement is on its way.</p>
            <p className="mt-5 whitespace-pre-wrap border-t border-line pt-4 text-muted">{p.signature.trim() || "Your signature will appear here."}</p>
          </div>
        </div>
      </div>
    </form>
  );
}

export function ChangeEmailForm({ email }: { email: string }) {
  const [s, act, pending] = useActionState(changeEmailAction, undefined as { error?: string; done?: boolean } | undefined);
  return (
    <form action={act} className="max-w-md space-y-4">
      <ErrorSummary message={s?.error} />
      {s?.done && <p role="status" className="text-sm text-moss">Email changed. Use it next time you sign in.</p>}
      <p className="text-sm text-muted">Signed in as <strong className="text-ink break-all">{email}</strong></p>
      <div><label className="label" htmlFor="ce-email">New email</label><input id="ce-email" name="email" type="email" inputMode="email" autoCapitalize="none" className="field" required autoComplete="off" /></div>
      <div><label className="label" htmlFor="ce-pw">Your password</label><input id="ce-pw" name="password" type="password" className="field" required autoComplete="current-password" /><p className="hint mt-1">We ask so nobody else can change it on your behalf.</p></div>
      <button className="btn" disabled={pending}>{pending ? "Changing…" : "Change email"}</button>
    </form>
  );
}
