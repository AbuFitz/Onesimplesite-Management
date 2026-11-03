import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { documentValues } from "@/modules/settings/plans";
import { fillVars } from "@/modules/settings/variables";
import { LEGAL, PUBLIC_LEGAL } from "@/modules/settings/legal-docs";
import { splitIntro } from "@/modules/settings/legal-starters";
import { AgreementText } from "@/components/agreement";
import { LegalSheet } from "@/components/legal-sheet";
import { LegalLinks } from "@/components/legal-links";
import { PublicShell } from "@/components/public-shell";

export const dynamic = "force-dynamic";
const NAMES: Record<string, string> = { terms: "Portal Terms of Use", privacy: "Privacy Notice", cookies: "Cookie Notice" };
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return { title: NAMES[slug] ?? "Legal", robots: { index: false } }; }

/** The live version of a legal page. Only a published version is ever shown. Works on both the client portal and the team app. */
export default async function PublicLegal({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const kind = PUBLIC_LEGAL[slug];
  if (!kind) notFound();
  const w = await db.workspace.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  const t = w ? await db.termsVersion.findFirst({ where: { workspaceId: w.id, kind, status: "published" }, orderBy: { number: "desc" } }) : null;
  const m = LEGAL[kind];
  return (
    <PublicShell label="Legal">
      {!t ? (
        <div className="rounded-3xl bg-bone p-8"><h1 className="text-2xl">{NAMES[slug]}</h1><p className="mt-2 text-muted">This page is being finished. If you need it now, email <a className="underline" href="mailto:hello@onesimplesite.co.uk">hello@onesimplesite.co.uk</a>.</p></div>
      ) : await (async () => {
        const vars = await documentValues(w!.id);
        const { intro, rest } = splitIntro(t.body);
        return (
          <LegalSheet intro={intro ? fillVars(intro, vars) : undefined} meta={{ title: NAMES[slug], ref: m.ref, version: `${t.number}.0`, status: "Current", date: new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(t.publishedAt ?? t.createdAt), audience: m.audience }}>
            <AgreementText text={fillVars(rest, vars)} />
          </LegalSheet>
        );
      })()}
      <LegalLinks className="mt-8" />
    </PublicShell>
  );
}
