import { viewSigning, CONSENT_TEXT } from "@/modules/signing/service";
import { SignForm, DeclineForm } from "@/components/sign-form";
import { DocSheet, DocBody } from "@/components/doc";
import { SignShell } from "@/components/public-shell";
import { SignWorkspace } from "@/components/sign-workspace";
import { fmtDate } from "@/components/ui";
import { db } from "@/lib/db";
import { getCompany } from "@/modules/settings/service";
import { samplePack } from "@/modules/settings/sample";
import { documentValues } from "@/modules/settings/plans";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review and sign", robots: { index: false } };

const WHY: Record<string, string> = {
  expired: "This link has expired.", revoked: "This link was replaced or withdrawn.", signed: "This has already been signed. A confirmation was emailed to the signer.",
  invalid: "We couldn't find this link.", not_open: "This is no longer open for signing.",
};
const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(d);

/** /s/sample: the real signing page with a made-up order, for the team and the test emails. Nothing is recorded. */
async function SamplePage() {
  const w = await db.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  const latest = (kind: string) => w ? db.termsVersion.findFirst({ where: { workspaceId: w.id, kind, status: "published" } }).then((p) => p ?? db.termsVersion.findFirst({ where: { workspaceId: w.id, kind }, orderBy: { number: "desc" } })) : null;
  const [terms, sla, hosting] = await Promise.all([latest("terms"), latest("sla"), latest("hosting")]);
  const vars = w ? await documentValues(w.id) : {};
  const text = samplePack(
    { legalName: w?.legalName ?? null, companyNumber: w?.companyNumber ?? null, registeredAddress: w?.registeredAddress ?? null, vatNumber: w?.vatNumber ?? null },
    { terms: { number: terms?.number ?? 1, body: terms?.body ?? "## Services\n1.1 Our Services Agreement appears here once it is written." }, ...(sla ? { sla: { number: sla.number, body: sla.body } } : {}), ...(hosting ? { hosting: { number: hosting.number, body: hosting.body } } : {}) }, vars,
  );
  return (
    <SignShell>
      <div role="note" className="mx-auto mb-5 max-w-[794px] rounded-2xl bg-[#fbf3d5] px-4 py-3 text-sm text-[#5c4700]"><strong>This is a sample.</strong> It shows exactly what a customer sees. You can try signing; nothing is recorded and no one is emailed.</div>
      <SignWorkspace title="Website for Sample Café" reference="OSS-OF-2026-047"
        doc={<DocSheet meta={{ title: "Website for Sample Café", ref: "OSS-OF-2026-047", date: day(new Date()), version: "1.0", status: "Sample", mark: "Prepared for Sample Café Ltd" }}><DocBody text={text} hideSign={(l) => l.startsWith("Accepted by")} /></DocSheet>}
        panel={<SignForm token="sample" defaultName="Alex Sample" consent={CONSENT_TEXT} business="Sample Café Ltd" />} />
    </SignShell>
  );
}

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token === "sample") return SamplePage();
  const r = await viewSigning(token);
  if (!r.ok) {
    return (
      <SignShell>
        <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 shadow-[0_2px_28px_rgba(14,19,17,.08)]">
          <h1 className="mb-2 text-2xl">This link isn't available</h1>
          <p>{WHY[r.reason]}</p>
          <p className="mt-3 text-muted">Need a new link? Email <a className="underline" href="mailto:hello@onesimplesite.co.uk">hello@onesimplesite.co.uk</a> and quote your reference.</p>
        </div>
      </SignShell>
    );
  }
  const first = r.signerName.split(" ")[0];
  return (
    <SignShell>
      <section className="mb-4" aria-labelledby="hi">
        <h1 id="hi" className="text-2xl font-semibold leading-tight sm:text-[1.7rem]">Hi {first}, your order is ready to review</h1>
        <p className="mt-1 text-[15px] text-muted">Read it through, then sign. It takes about two minutes, and you have until {fmtDate(r.expiresAt)}.</p>
      </section>
      <SignWorkspace title={r.title} reference={r.reference} pdfHref={`/s/${token}/pdf`}
        doc={<DocSheet meta={{ title: r.title, ref: r.reference, date: day(r.sentAt), version: "1.0", status: "Issued", mark: `Prepared for ${r.business}` }}><DocBody text={r.contentText} hideSign={(l) => l.startsWith("Accepted by")} /></DocSheet>}
        panel={<><SignForm token={token} defaultName={r.signerName} consent={CONSENT_TEXT} business={r.business} /><DeclineForm token={token} /></>} />
    </SignShell>
  );
}
