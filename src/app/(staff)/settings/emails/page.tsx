import Link from "next/link";
import { requireStaff } from "@/modules/identity/session";
import { EMAILS, sampleEmail } from "@/modules/settings/email-samples";
import { EmailTestButton } from "@/components/email-test-button";
import { SettingsNav } from "@/components/settings-nav";
import { RecordHeader } from "@/components/ui";

export const metadata = { title: "Emails" };

export default async function Emails({ searchParams }: { searchParams: Promise<{ e?: string; w?: string }> }) {
  await requireStaff("settings.write");
  const sp = await searchParams;
  const cur = EMAILS.find((x) => x.id === sp.e) ?? EMAILS[0];
  const phone = sp.w === "phone";
  const r = await sampleEmail(cur.id);
  const href = (e: string, w = phone ? "phone" : "desktop") => `/settings/emails?e=${e}&w=${w}`;
  return (
    <>
      <RecordHeader title="Settings" meta="Company details, legal documents and emails" />
      <SettingsNav current="emails" />
      <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
        <nav aria-label="Emails" className="space-y-5">
          {(["Customer", "Team"] as const).map((aud) => (
            <div key={aud}>
              <p className="mb-1 text-xs font-medium text-muted">{aud === "Customer" ? "Customers receive" : "Our team receives"}</p>
              <ul>{EMAILS.filter((x) => x.audience === aud).map((x) => (
                <li key={x.id}><Link href={href(x.id)} aria-current={x.id === cur.id ? "page" : undefined} className={`block rounded-lg px-3 py-2 text-sm hover:bg-soft ${x.id === cur.id ? "bg-soft font-semibold" : ""}`}>{x.label}</Link></li>
              ))}</ul>
            </div>
          ))}
        </nav>
        <section aria-labelledby="em">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><h2 id="em">{cur.label}</h2><p className="text-sm text-muted">{cur.when}</p></div>
            <div className="flex gap-2"><Link className={`btn ${phone ? "btn-quiet" : ""}`} href={href(cur.id, "desktop")}>Desktop</Link><Link className={`btn ${phone ? "" : "btn-quiet"}`} href={href(cur.id, "phone")}>Phone</Link></div>
          </div>
          <div className="mb-4 flex flex-wrap items-start gap-3"><EmailTestButton only={cur.id} label="Send this one to hello@" /><EmailTestButton label="Send all test emails to hello@" /></div>
          <div className="mb-3 rounded-xl border border-line px-4 py-3 text-sm"><span className="text-muted">Subject</span><p className="font-semibold break-words">{r.subject}</p></div>
          <div className="rounded-2xl bg-[#eef0ee] p-3 sm:p-6">
            <iframe title={`${cur.label} preview`} srcDoc={r.html} sandbox="" className="mx-auto block h-[44rem] max-w-full rounded-lg bg-white" style={{ width: phone ? 390 : 680 }} />
          </div>
          <p className="hint mt-3">Made-up names and links. Wording and layout are exactly what gets sent. The test buttons send to hello@ only, with [TEST] in the subject.</p>
        </section>
      </div>
    </>
  );
}
