import Image from "next/image";
import { viewSigning, CONSENT_TEXT } from "@/modules/signing/service";
import { SignForm, DeclineForm } from "@/components/sign-form";
import { AgreementText } from "@/components/agreement";
import { fmtDate } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review and sign", robots: { index: false } };

const WHY: Record<string, string> = {
  expired: "This link has expired.", revoked: "This link was replaced or withdrawn.", signed: "This agreement has already been signed. A confirmation was emailed to the signer.",
  invalid: "We could not find this link.", not_open: "This agreement is no longer open for signing.",
};

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await viewSigning(token);
  if (!r.ok) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <Image src="/brand/wordmark-colour.svg" alt="OneSimpleSite" width={160} height={32} />
        <h1 className="mt-8 text-[22px]">This link is not available</h1>
        <p className="mt-2">{WHY[r.reason]}</p>
        <p className="mt-2 text-muted">If you need a new link, email <a className="underline" href="mailto:hello@onesimplesite.co.uk">hello@onesimplesite.co.uk</a> and quote your agreement reference.</p>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 pb-24">
      <Image src="/brand/wordmark-colour.svg" alt="OneSimpleSite" width={160} height={32} priority />
      <p className="mt-8 text-sm text-muted">{r.business} · {r.reference} · sign by {fmtDate(r.expiresAt)}</p>
      <h1 className="mb-6">{r.title}</h1>
      <AgreementText text={r.contentText} />
      <SignForm token={token} defaultName={r.signerName} consent={CONSENT_TEXT} />
      <DeclineForm token={token} />
    </main>
  );
}
