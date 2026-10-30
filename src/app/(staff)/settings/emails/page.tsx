import Link from "next/link";
import { requireStaff } from "@/modules/identity/session";
import { renderEmail, type TemplateName } from "@/emails/templates";
import { RecordHeader } from "@/components/ui";

export const metadata = { title: "Emails" };

const SAMPLE_LINK = "https://portal.onesimplesite.co.uk/s/example";
/** Every email the system sends, in the order a customer meets them, with what triggers it. */
const EMAILS: { id: TemplateName; label: string; audience: "Customer" | "Team"; when: string }[] = [
  { id: "contract_request", label: "Agreement to sign", audience: "Customer", when: "When you press Send agreement on a quote. One email, one link." },
  { id: "signing_confirmation", label: "Signed copy", audience: "Customer", when: "Straight after they sign. The signed PDF is attached." },
  { id: "invitation", label: "Portal invitation", audience: "Customer", when: "When you invite a customer to their client portal." },
  { id: "password_reset", label: "Password reset", audience: "Customer", when: "When anyone asks to reset a password." },
  { id: "password_changed", label: "Password changed", audience: "Customer", when: "After a password is changed, as a safety notice." },
  { id: "signing_notice", label: "Signed notice to us", audience: "Team", when: "Sent to hello@ when a customer signs." },
  { id: "staff_invitation", label: "Team invitation", audience: "Team", when: "When you add someone to the team." },
  { id: "backup_reminder", label: "Backup reminder", audience: "Team", when: "Weekly, if no backup has been taken." },
];

function sample(id: TemplateName) {
  const to = "customer@example.com";
  switch (id) {
    case "contract_request": return renderEmail(id, { to, signerName: "Alex", title: "Website for Sample Café", ref: "K-0000", link: SAMPLE_LINK, expires: "30 November 2026", business: "Sample Café Ltd" });
    case "signing_confirmation": return renderEmail(id, { to, signerName: "Alex", title: "Website for Sample Café", ref: "K-0000", signedAt: "30 October 2026, 14:05", fileSha: "9f2c1ab07d3e44f1", hasAttachment: true });
    case "invitation": return renderEmail(id, { to, businessName: "Sample Café Ltd", inviter: "Jamie at OneSimpleSite", link: SAMPLE_LINK, expires: "6 November 2026" });
    case "password_reset": return renderEmail(id, { to, name: "Alex", link: SAMPLE_LINK, minutes: 60 });
    case "password_changed": return renderEmail(id, { to, name: "Alex", when: "30 October 2026, 14:05" });
    case "signing_notice": return renderEmail(id, { to: "hello@onesimplesite.co.uk", title: "Website for Sample Café", ref: "K-0000", business: "Sample Café Ltd", signerName: "Alex", signerEmail: to, signedAt: "30 October 2026, 14:05", link: "https://manage.onesimplesite.co.uk/contracts/example", fileSha: "9f2c1ab07d3e44f1" });
    case "staff_invitation": return renderEmail(id, { to: "new.person@onesimplesite.co.uk", name: "New Person", inviter: "Jamie", roleLabel: "Team member", link: "https://manage.onesimplesite.co.uk/invite/example", expires: "6 November 2026" });
    case "backup_reminder": return renderEmail(id, { to: "hello@onesimplesite.co.uk", lastBackup: "23 October 2026", link: "https://manage.onesimplesite.co.uk/backup" });
    default: return renderEmail("password_changed", { to, name: "Alex", when: "" });
  }
}

export default async function Emails({ searchParams }: { searchParams: Promise<{ e?: string; w?: string }> }) {
  await requireStaff("settings.write");
  const sp = await searchParams;
  const cur = EMAILS.find((x) => x.id === sp.e) ?? EMAILS[0];
  const phone = sp.w === "phone";
  const r = await sample(cur.id);
  const href = (e: string, w = phone ? "phone" : "desktop") => `/settings/emails?e=${e}&w=${w}`;
  return (
    <>
      <RecordHeader title="Settings" meta="Company details, Terms & Conditions and emails" />
      <nav aria-label="Settings sections" className="mb-8 flex gap-2"><Link className="btn btn-quiet" href="/settings">Company details</Link><Link className="btn btn-quiet" href="/settings/terms">Terms &amp; Conditions</Link><Link className="btn" href="/settings/emails">Emails</Link></nav>
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
          <div className="mb-3 rounded-xl border border-line px-4 py-3 text-sm"><span className="text-muted">Subject</span><p className="font-semibold break-words">{r.subject}</p></div>
          <div className="rounded-2xl bg-[#eef0ee] p-3 sm:p-6">
            <iframe title={`${cur.label} preview`} srcDoc={r.html} sandbox="" className="mx-auto block h-[44rem] max-w-full rounded-lg bg-white" style={{ width: phone ? 390 : 680 }} />
          </div>
          <p className="hint mt-3">Made-up names and links. Wording and layout are exactly what gets sent.</p>
        </section>
      </div>
    </>
  );
}
