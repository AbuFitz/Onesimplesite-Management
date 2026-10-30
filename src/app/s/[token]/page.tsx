import { viewSigning, CONSENT_TEXT } from "@/modules/signing/service";
import { SignForm, DeclineForm } from "@/components/sign-form";
import { AgreementText } from "@/components/agreement";
import { PublicShell } from "@/components/public-shell";
import { fmtDate } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review and sign", robots: { index: false } };

const WHY: Record<string, string> = {
  expired: "This link has expired.", revoked: "This link was replaced or withdrawn.", signed: "This agreement has already been signed. A confirmation was emailed to the signer.",
  invalid: "We couldn't find this link.", not_open: "This agreement is no longer open for signing.",
};

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await viewSigning(token);
  if (!r.ok) {
    return (
      <PublicShell narrow>
        <h1 className="mb-2">This link isn't available</h1>
        <p>{WHY[r.reason]}</p>
        <p className="mt-3 text-muted">Need a new link? Email <a className="underline" href="mailto:hello@onesimplesite.co.uk">hello@onesimplesite.co.uk</a> and quote your agreement reference.</p>
      </PublicShell>
    );
  }
  return (
    <PublicShell label="Secure signing">
      <p className="mb-1 text-sm text-muted">{r.business} · {r.reference}</p>
      <h1 className="mb-1">{r.title}</h1>
      <p className="mb-8 text-sm text-muted">Please read the agreement and sign by {fmtDate(r.expiresAt)}.</p>
      <AgreementText text={r.contentText} />
      <div className="sticky bottom-0 z-10 -mx-5 mt-6 border-t border-line bg-white/95 px-5 py-3 backdrop-blur sm:hidden" style={{ paddingBottom: "max(.75rem, env(safe-area-inset-bottom))" }}>
        <a href="#sign" className="btn w-full">Continue to sign</a>
      </div>
      <div id="sign" className="scroll-mt-4"><SignForm token={token} defaultName={r.signerName} consent={CONSENT_TEXT} /></div>
      <DeclineForm token={token} />
    </PublicShell>
  );
}
